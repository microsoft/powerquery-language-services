// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, AstUtils, IdentifierExpressionUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    AstXorNode,
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";

import { assertGetOrCreateNodeScope, ScopeById, ScopeItemKind, TScopeItem } from "../scope";
import {
    DereferencedIdentifierExternal,
    DereferencedIdentifierKind,
    DereferencedIdentifierUndefined,
    TDereferencedIdentifier,
} from "././dereferencedIdentifier";
import { ExternalTypeUtils, Inspection, InspectionSettings, TraceUtils } from "../..";
import { InspectionTraceConstant } from "../../trace";

// Recursively dereference the identifier until it reaches either:
// - A recursive identifier which is not supported
// - A value node
// - An external type
// - Undefined
//
// Below some examples of dereferencing local identifiers with the recursive '@' prefix.
//
// Evaluates to: [key1 = 42, key2 = 42]
// let foo = 42 in [key1 = foo, key2 = @foo]
//
// Evaluates to: -1
// let
//   SomeFunction = (x as number) => -1,
//   Record = [SomeFunction = (x as number) => if x = 42 then 42 else SomeFunction(x + 1)]
// in
//   Record[SomeFunction](0)
//
// Evaluates to: 42
// let
//   SomeFunction = (x as number) => -1,
//   Record = [SomeFunction = (x as number) => if x = 42 then 42 else @SomeFunction(x + 1)]
// in
//   Record[SomeFunction](0)
export async function tryBuildDereferencedIdentifierPath(
    inspectionSettings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    // If a map is given, then it's mutated and returned.
    // Else create a new Map instance and return that instead.
    scopeById: ScopeById = new Map(),
): Promise<PQP.Result<ReadonlyArray<TDereferencedIdentifier>, PQP.CommonError.CommonError>> {
    const trace: Trace = inspectionSettings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        tryBuildDereferencedIdentifierPath.name,
        inspectionSettings.initialCorrelationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    const updatedSettings: InspectionSettings = {
        ...inspectionSettings,
        initialCorrelationId: trace.id,
    };

    try {
        XorNodeUtils.assertIsIdentifier(xorNode);

        if (XorNodeUtils.isContext(xorNode)) {
            trace.exit({ [TraceConstant.IsThrowing]: true });

            throw new PQP.CommonError.InvariantError(`expected xorNode to be an identifier`, { xorNode });
        }

        const dereferenceResult: PQP.Result<
            ReadonlyArray<TDereferencedIdentifier>,
            PQP.CommonError.CommonError
        > = await dereferenceScopeItem(updatedSettings, nodeIdMapCollection, xorNode, scopeById, xorNode);

        trace.exit();

        return dereferenceResult;
    } catch (caught: unknown) {
        Assert.isInstanceofError(caught);

        trace.exit();

        return ResultUtils.error(PQP.CommonError.ensureCommonError(caught, inspectionSettings.locale));
    }
}

async function dereferenceScopeItem(
    inspectionSettings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    identifierAstXorNode: AstXorNode<Ast.Identifier | Ast.IdentifierExpression>,
    scopeById: ScopeById,
    initialIdentifierXorNode: AstXorNode<Ast.Identifier | Ast.IdentifierExpression>,
): Promise<PQP.Result<ReadonlyArray<TDereferencedIdentifier>, PQP.CommonError.CommonError>> {
    const trace: Trace = inspectionSettings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        dereferenceScopeItem.name,
        inspectionSettings.initialCorrelationId,
        TraceUtils.xorNodeDetails(identifierAstXorNode),
    );

    const updatedSettings: InspectionSettings = {
        ...inspectionSettings,
        initialCorrelationId: trace.id,
    };

    const dereferencedPath: TDereferencedIdentifier[] = [];

    const initialTriedNodeScope: Inspection.TriedNodeScope = await assertGetOrCreateNodeScope(
        updatedSettings,
        nodeIdMapCollection,
        updatedSettings.eachScopeById,
        initialIdentifierXorNode.node.id,
        scopeById,
    );

    if (ResultUtils.isError(initialTriedNodeScope)) {
        trace.exit({ [TraceConstant.Result]: initialTriedNodeScope.kind });

        return initialTriedNodeScope;
    }

    let currentScopeItem: TScopeItem | undefined = initialTriedNodeScope.value.get(
        AstUtils.getIdentifierLiteral(initialIdentifierXorNode.node),
    );

    let currentIdentifierLiteral: string = AstUtils.getIdentifierLiteral(initialIdentifierXorNode.node);

    if (currentScopeItem === undefined) {
        return onIdentifierNotInScope(
            dereferencedPath,
            identifierAstXorNode,
            trace,
            updatedSettings,
            currentIdentifierLiteral,
        );
    }

    while (currentScopeItem.kind) {
        const currentXorNode: TXorNode = NodeIdMapUtils.assertXor(nodeIdMapCollection, currentScopeItem.nodeId);

        switch (currentScopeItem.kind) {
            case ScopeItemKind.LetVariable:
            case ScopeItemKind.RecordField:
            case ScopeItemKind.SectionMember:
                // eslint-disable-next-line no-lone-blocks
                {
                    const potentialDereference: TXorNode | undefined = currentScopeItem.value;

                    // Most commonly happens when a variable has yet to be defined,
                    // for example, a context node for a RecordExpression `[let foo = 1, bar = |`
                    if (potentialDereference === undefined) {
                        return onIdentifierNotInScope(
                            dereferencedPath,
                            currentXorNode,
                            trace,
                            updatedSettings,
                            currentIdentifierLiteral,
                        );
                    }

                    // It's referencing another identifier
                    if (
                        potentialDereference !== undefined &&
                        XorNodeUtils.isAstChecked<Ast.Identifier | Ast.IdentifierExpression>(potentialDereference, [
                            Ast.NodeKind.Identifier,
                            Ast.NodeKind.IdentifierExpression,
                        ])
                    ) {
                        currentIdentifierLiteral = AstUtils.getIdentifierLiteral(potentialDereference.node);

                        // If it's a non-recursive dereference
                        if (!currentScopeItem.isRecursive) {
                            // Generate the scope for the next dereference (if needed)
                            // eslint-disable-next-line no-await-in-loop
                            const triedNodeScope: Inspection.TriedNodeScope = await assertGetOrCreateNodeScope(
                                updatedSettings,
                                nodeIdMapCollection,
                                updatedSettings.eachScopeById,
                                potentialDereference.node.id,
                                scopeById,
                            );

                            if (ResultUtils.isError(triedNodeScope)) {
                                trace.exit({ [TraceConstant.Result]: triedNodeScope.kind });

                                return triedNodeScope;
                            }

                            const nextScopeItem: TScopeItem | undefined =
                                triedNodeScope.value.get(currentIdentifierLiteral);

                            if (nextScopeItem === undefined) {
                                return onIdentifierNotInScope(
                                    dereferencedPath,
                                    currentXorNode,
                                    trace,
                                    updatedSettings,
                                    currentIdentifierLiteral,
                                );
                            }

                            dereferencedPath.push({
                                kind: DereferencedIdentifierKind.InScopeDereference,
                                xorNode: currentXorNode,
                                identifierLiteral: currentIdentifierLiteral,
                                nextScopeItem,
                            });

                            currentScopeItem = nextScopeItem;
                        }
                        // Else if it's a recursive scopeItem and we ARE looking for a recursive scopeItem,
                        // then we're done.
                        else if (currentIdentifierLiteral.startsWith("@")) {
                            return onRecursiveIdentifierLiteral(
                                dereferencedPath,
                                currentXorNode,
                                trace,
                                currentIdentifierLiteral,
                            );
                        }
                        // Else it's a recursive scopeItem and we ARE NOT looking for a recursive scopeItem,
                        // then look up the ancestry chain for a non-recursive scopeItem of the same name.
                        else {
                            const ancestoryScopeItem: TScopeItem | undefined = findNonRecursiveScopeItemInAncestors(
                                nodeIdMapCollection,
                                scopeById,
                                currentIdentifierLiteral,
                                currentXorNode.node.id,
                            );

                            if (ancestoryScopeItem === undefined) {
                                return onIdentifierNotInScope(
                                    dereferencedPath,
                                    currentXorNode,
                                    trace,
                                    updatedSettings,
                                    currentIdentifierLiteral,
                                );
                            }

                            currentScopeItem = ancestoryScopeItem;
                        }
                    } else {
                        return onInScopeValue(dereferencedPath, currentXorNode, trace, currentScopeItem);
                    }
                }

                break;

            case ScopeItemKind.Each:
                return onInScopeValue(dereferencedPath, currentXorNode, trace, currentScopeItem);

            case ScopeItemKind.Parameter:
                return onInScopeValue(dereferencedPath, currentXorNode, trace, currentScopeItem);

            case ScopeItemKind.Undefined:
                dereferencedPath.push({
                    kind: DereferencedIdentifierKind.Undefined,
                    identifierLiteral: currentIdentifierLiteral,
                    xorNode: currentXorNode,
                });

                trace.exit();

                return ResultUtils.ok(dereferencedPath);

            default:
                throw Assert.isNever(currentScopeItem);
        }
    }

    trace.exit();

    return ResultUtils.ok(dereferencedPath);
}

// Sometimes in the scope of a lower node (e.g. a leaf node) there's a scopeItem that matches the
// identifier literal we're looking for, but it's marked as recursive.
// In that case we want to look up the tree to see if there's a non-recursive scopeItem of the same name further up.
function findNonRecursiveScopeItemInAncestors(
    nodeIdMapCollection: NodeIdMap.Collection,
    scopeById: ScopeById,
    identifierLiteral: string,
    initialNodeId: number,
): TScopeItem | undefined {
    let currentNodeId: number | undefined = nodeIdMapCollection.parentIdById.get(initialNodeId);

    while (currentNodeId) {
        const scopeItem: TScopeItem | undefined = scopeById.get(currentNodeId)?.get(identifierLiteral);

        if (scopeItem && !scopeItem.isRecursive) {
            return scopeItem;
        }

        currentNodeId = nodeIdMapCollection.parentIdById.get(currentNodeId);
    }

    return undefined;
}

// Validates whether an unknown identifier is an externally defined type (e.g. a built-in function)
function onIdentifierNotInScope(
    dereferencePath: TDereferencedIdentifier[],
    xorNode: TXorNode,
    trace: Trace,
    inspectionSettings: InspectionSettings,
    identifierLiteral: string,
): PQP.Result<TDereferencedIdentifier[], PQP.CommonError.CommonError> {
    const externalType: TPowerQueryType | undefined = inspectionSettings.library.externalTypeResolver(
        ExternalTypeUtils.valueTypeRequest(
            IdentifierExpressionUtils.assertNormalizedIdentifierExpression(identifierLiteral),
        ),
    );

    const finalPath: DereferencedIdentifierExternal | DereferencedIdentifierUndefined = externalType
        ? {
              kind: DereferencedIdentifierKind.External,
              xorNode,
              identifierLiteral,
              type: externalType,
          }
        : {
              kind: DereferencedIdentifierKind.Undefined,
              xorNode,
              identifierLiteral,
          };

    dereferencePath.push(finalPath);

    trace.exit({ [TraceConstant.Result]: finalPath });

    return ResultUtils.ok(dereferencePath);
}

function onInScopeValue(
    dereferencePath: TDereferencedIdentifier[],
    xorNode: TXorNode,
    trace: Trace,
    scopeItem: TScopeItem,
): PQP.Result<ReadonlyArray<TDereferencedIdentifier>, PQP.CommonError.CommonError> {
    dereferencePath.push({
        kind: DereferencedIdentifierKind.InScopeValue,
        xorNode,
        scopeItem,
    });

    trace.exit();

    return ResultUtils.ok(dereferencePath);
}

function onRecursiveIdentifierLiteral(
    dereferencePath: TDereferencedIdentifier[],
    xorNode: TXorNode,
    trace: Trace,
    identifierLiteral: string,
): PQP.Result<ReadonlyArray<TDereferencedIdentifier>, PQP.CommonError.CommonError> {
    dereferencePath.push({
        kind: DereferencedIdentifierKind.Recursive,
        xorNode,
        identifierLiteral,
    });

    trace.exit();

    return ResultUtils.ok(dereferencePath);
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, AstUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    AstXorNode,
    NodeIdMap,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";

import { assertGetOrCreateNodeScope, NodeScope, ScopeById, ScopeItemKind, TScopeItem } from "../scope";
import {
    DereferencedIdentifierExternal,
    DereferencedIdentifierKind,
    DereferencedIdentifierUndefined,
    TDereferencedIdentifier,
} from "././dereferencedIdentifier";
import { ExternalTypeUtils, Inspection, InspectionSettings, TraceUtils } from "../..";
import { InspectionTraceConstant } from "../../trace";
import { TypeById } from "../typeCache";

// Recursively dereference the identifier until it reaches either:
// - A value node
// - An external type
// - Undefined
export async function tryBuildDereferencedIdentifierPath(
    inspectionSettings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    eachScopeById: TypeById | undefined,
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
        > = await dereferenceScopeItem(updatedSettings, nodeIdMapCollection, eachScopeById, xorNode, scopeById, []);

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
    eachScopeById: TypeById | undefined,
    identifierAstXorNode: AstXorNode<Ast.Identifier | Ast.IdentifierExpression>,
    scopeById: ScopeById,
    path: TDereferencedIdentifier[],
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

    let currentIdentifierLiteral = AstUtils.getIdentifierLiteral(identifierAstXorNode.node);
    let currentXorNode = identifierAstXorNode;

    while (currentIdentifierLiteral !== undefined) {
        if (currentXorNode === undefined) {
            return onIdentifierNotInScope(path, trace, updatedSettings, currentIdentifierLiteral);
        }

        // eslint-disable-next-line no-await-in-loop
        const triedNodeScope: Inspection.TriedNodeScope = await assertGetOrCreateNodeScope(
            inspectionSettings,
            nodeIdMapCollection,
            eachScopeById,
            currentXorNode.node.id,
            scopeById,
        );

        if (ResultUtils.isError(triedNodeScope)) {
            trace.exit({ [TraceConstant.Result]: triedNodeScope.kind });

            return triedNodeScope;
        }

        const nodeScope: NodeScope = triedNodeScope.value;
        let scopeItem: TScopeItem | undefined = nodeScope.get(currentIdentifierLiteral);

        if (scopeItem === undefined && currentIdentifierLiteral.startsWith("@")) {
            scopeItem = nodeScope.get(currentIdentifierLiteral.slice(1));
        }

        if (scopeItem === undefined) {
            return onIdentifierNotInScope(path, trace, updatedSettings, currentIdentifierLiteral);
        }

        switch (scopeItem.kind) {
            case ScopeItemKind.LetVariable:
            case ScopeItemKind.RecordField:
            case ScopeItemKind.SectionMember:
                const possibleToDerefence: TXorNode | undefined = scopeItem.value;

                if (
                    possibleToDerefence !== undefined &&
                    XorNodeUtils.isAstChecked<Ast.Identifier | Ast.IdentifierExpression>(possibleToDerefence, [
                        Ast.NodeKind.Identifier,
                        Ast.NodeKind.IdentifierExpression,
                    ])
                ) {
                    path.push({
                        kind: DereferencedIdentifierKind.InScopeDereference,
                        identifierLiteral: currentIdentifierLiteral,
                        nextScopeItem: scopeItem,
                    });

                    currentIdentifierLiteral = AstUtils.getIdentifierLiteral(possibleToDerefence.node);

                    // Infinite recursion on an inclusive identifier.
                    // There's no good way to handle the type of this as it requires evaluation, so mark it as any.
                    if (
                        currentIdentifierLiteral.startsWith("@") &&
                        currentXorNode.node.id === possibleToDerefence.node.id
                    ) {
                        return onRecursiveIdentifierLiteral(path, trace, currentIdentifierLiteral);
                    }

                    currentXorNode = possibleToDerefence;
                } else {
                    return onInScopeValue(path, trace, scopeItem);
                }

                break;

            case ScopeItemKind.Each:
                return onInScopeValue(path, trace, scopeItem);

            case ScopeItemKind.Parameter:
                return onInScopeValue(path, trace, scopeItem);

            case ScopeItemKind.Undefined:
                return onIdentifierNotInScope(path, trace, updatedSettings, currentIdentifierLiteral);

            default:
                throw Assert.isNever(scopeItem);
        }
    }

    trace.exit();

    return ResultUtils.ok(path);
}

function onIdentifierNotInScope(
    path: TDereferencedIdentifier[],
    trace: Trace,
    inspectionSettings: InspectionSettings,
    identifierLiteral: string,
): PQP.Result<TDereferencedIdentifier[], PQP.CommonError.CommonError> {
    const externalType: TPowerQueryType | undefined = inspectionSettings.library.externalTypeResolver(
        ExternalTypeUtils.valueTypeRequest(identifierLiteral),
    );

    const finalPath: DereferencedIdentifierExternal | DereferencedIdentifierUndefined = externalType
        ? {
              kind: DereferencedIdentifierKind.External,
              identifierLiteral,
              type: externalType,
          }
        : {
              kind: DereferencedIdentifierKind.Undefined,
              identifierLiteral,
          };

    path.push(finalPath);

    trace.exit({ [TraceConstant.Result]: finalPath });

    return ResultUtils.ok(path);
}

function onInScopeValue(
    path: TDereferencedIdentifier[],
    trace: Trace,
    scopeItem: TScopeItem,
): PQP.Result<ReadonlyArray<TDereferencedIdentifier>, PQP.CommonError.CommonError> {
    path.push({
        kind: DereferencedIdentifierKind.InScopeValue,
        scopeItem,
    });

    trace.exit();

    return ResultUtils.ok(path);
}

function onRecursiveIdentifierLiteral(
    path: TDereferencedIdentifier[],
    trace: Trace,
    identifierLiteral: string,
): PQP.Result<ReadonlyArray<TDereferencedIdentifier>, PQP.CommonError.CommonError> {
    path.push({
        kind: DereferencedIdentifierKind.Recursive,
        identifierLiteral,
    });

    trace.exit();

    return ResultUtils.ok(path);
}

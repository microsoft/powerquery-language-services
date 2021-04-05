// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";
import { assertGetOrCreateNodeScope, NodeScope, ScopeItemKind, TScopeItem } from "./scope";
import { InspectionSettings } from "./settings";
import { TriedType, tryType } from "./type";
import { createTypeCache, TypeCache } from "./typeCache";

export type TriedInvokeExpression = PQP.Result<InvokeExpression | undefined, PQP.CommonError.CommonError>;

export interface InvokeExpression {
    readonly xorNode: PQP.Parser.TXorNode;
    readonly functionType: PQP.Language.Type.PowerQueryType;
    readonly isNameInLocalScope: boolean;
    readonly maybeName: string | undefined;
    readonly maybeArguments: InvokeExpressionArguments | undefined;
}

export interface InvokeExpressionArguments {
    readonly numMaxExpectedArguments: number;
    readonly numMinExpectedArguments: number;
    readonly givenArguments: ReadonlyArray<PQP.Parser.TXorNode>;
    readonly givenArgumentTypes: ReadonlyArray<PQP.Language.Type.PowerQueryType>;
    readonly argumentOrdinal: number;
    readonly typeCheck: PQP.Language.TypeUtils.CheckedInvocation;
}

export function tryInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    maybeActiveNode: TMaybeActiveNode,
    maybeTypeCache: TypeCache | undefined = undefined,
): TriedInvokeExpression {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return PQP.ResultUtils.createOk(undefined);
    }

    return PQP.ResultUtils.ensureResult(settings.locale, () =>
        inspectInvokeExpression(
            settings,
            nodeIdMapCollection,
            leafNodeIds,
            maybeActiveNode,
            maybeTypeCache ?? createTypeCache(),
        ),
    );
}

function inspectInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    activeNode: ActiveNode,
    typeCache: TypeCache,
): InvokeExpression | undefined {
    const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;
    const numAncestors: number = activeNode.ancestry.length;

    for (let ancestryIndex: number = 0; ancestryIndex < numAncestors; ancestryIndex += 1) {
        const xorNode: PQP.Parser.TXorNode = ancestry[ancestryIndex];

        if (xorNode.node.kind === PQP.Language.Ast.NodeKind.InvokeExpression) {
            const previousNode: PQP.Parser.TXorNode = PQP.Parser.NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
                nodeIdMapCollection,
                xorNode.node.id,
            );

            const functionType: PQP.Language.Type.PowerQueryType = Assert.unwrapOk(
                tryType(settings, nodeIdMapCollection, leafNodeIds, previousNode.node.id, typeCache),
            );
            const maybeName: string | undefined = PQP.Parser.NodeIdMapUtils.maybeInvokeExpressionIdentifierLiteral(
                nodeIdMapCollection,
                xorNode.node.id,
            );

            let maybeInvokeExpressionArgs: InvokeExpressionArguments | undefined;
            if (PQP.Language.TypeUtils.isDefinedFunction(functionType)) {
                const iterableArguments: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.NodeIdMapIterator.iterInvokeExpression(
                    nodeIdMapCollection,
                    xorNode,
                );

                const givenArgumentTypes: ReadonlyArray<PQP.Language.Type.PowerQueryType> = getArgumentTypes(
                    settings,
                    nodeIdMapCollection,
                    leafNodeIds,
                    typeCache,
                    iterableArguments,
                );
                const givenArguments: ReadonlyArray<PQP.Parser.TXorNode> = iterableArguments.slice(
                    0,
                    givenArgumentTypes.length,
                );

                const [numMinExpectedArguments, numMaxExpectedArguments] = getNumExpectedArguments(functionType);

                maybeInvokeExpressionArgs = {
                    argumentOrdinal: getArgumentOrdinal(activeNode, ancestryIndex),
                    givenArguments,
                    givenArgumentTypes,
                    numMaxExpectedArguments,
                    numMinExpectedArguments,
                    typeCheck: PQP.Language.TypeUtils.typeCheckInvocation(givenArgumentTypes, functionType),
                };
            }

            return {
                xorNode,
                functionType,
                isNameInLocalScope: getIsNameInLocalScope(
                    settings,
                    nodeIdMapCollection,
                    leafNodeIds,
                    typeCache,
                    xorNode,
                    maybeName,
                ),
                maybeName,
                maybeArguments: maybeInvokeExpressionArgs,
            };
        }
    }

    return undefined;
}

function getIsNameInLocalScope(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    typeCache: TypeCache,
    invokeExpressionXorNode: PQP.Parser.TXorNode,
    maybeName: string | undefined,
): boolean {
    // Try to find out if the identifier is a local or external name.
    if (maybeName !== undefined) {
        // Seed local scope
        const scope: NodeScope = Assert.unwrapOk(
            assertGetOrCreateNodeScope(
                settings,
                nodeIdMapCollection,
                leafNodeIds,
                invokeExpressionXorNode.node.id,
                typeCache.scopeById,
            ),
        );
        const maybeNameScopeItem: TScopeItem | undefined = scope.get(maybeName);

        return maybeNameScopeItem !== undefined && maybeNameScopeItem.kind !== ScopeItemKind.Undefined;
    } else {
        return false;
    }
}

function getNumExpectedArguments(functionType: PQP.Language.Type.DefinedFunction): [number, number] {
    const nonOptionalArguments: ReadonlyArray<PQP.Language.Type.FunctionParameter> = functionType.parameters.filter(
        (parameter: PQP.Language.Type.FunctionParameter) => !parameter.isOptional,
    );

    const numMinExpectedArguments: number = nonOptionalArguments.length;
    const numMaxExpectedArguments: number = functionType.parameters.length;

    return [numMinExpectedArguments, numMaxExpectedArguments];
}

function getArgumentTypes(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    typeCache: TypeCache,
    argXorNodes: ReadonlyArray<PQP.Parser.TXorNode>,
): ReadonlyArray<PQP.Language.Type.PowerQueryType> {
    const result: PQP.Language.Type.PowerQueryType[] = [];

    for (const xorNode of argXorNodes) {
        const triedArgType: TriedType = tryType(settings, nodeIdMapCollection, leafNodeIds, xorNode.node.id, typeCache);
        if (PQP.ResultUtils.isError(triedArgType)) {
            throw triedArgType;
        }
        const argType: PQP.Language.Type.PowerQueryType = triedArgType.value;

        // Occurs when there's expected to be a trailing argument, but none exist.
        // Eg. `foo(|` will iterate over an TXorNode which: contains no parsed elements, and evaluates to unknown.
        if (
            PQP.Language.TypeUtils.isUnknown(argType) &&
            !PQP.Parser.NodeIdMapUtils.hasParsedToken(nodeIdMapCollection, xorNode.node.id)
        ) {
            Assert.isTrue(xorNode === argXorNodes[argXorNodes.length - 1]);
            return result;
        }

        result.push(argType);
    }

    return result;
}

function getArgumentOrdinal(activeNode: ActiveNode, ancestryIndex: number): number {
    const maybeAncestoryCsv:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.AncestryUtils.maybeNthPreviousXor(activeNode.ancestry, ancestryIndex, 2, [
        PQP.Language.Ast.NodeKind.Csv,
    ]);

    return maybeAncestoryCsv?.node.maybeAttributeIndex ?? 0;
}

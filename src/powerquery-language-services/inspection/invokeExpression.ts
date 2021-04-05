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
    readonly maybeArguments: InvokeExpressionArgs | undefined;
}

export interface InvokeExpressionArgs {
    readonly argumentOrdinal: number;
    readonly maybeTypeCheck: PQP.Language.TypeUtils.CheckedInvocation | undefined;
    readonly numArguments: number;
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

            const argXorNodes: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.NodeIdMapIterator.iterInvokeExpression(
                nodeIdMapCollection,
                xorNode,
            );

            let maybeInvokeExpressionArgs: InvokeExpressionArgs | undefined;
            if (argXorNodes.length) {
                maybeInvokeExpressionArgs = {
                    argumentOrdinal: getArgumentOrdinal(activeNode, ancestryIndex),
                    maybeTypeCheck: maybeTypeCheckedArguments(
                        getArgumentTypes(settings, nodeIdMapCollection, leafNodeIds, typeCache, argXorNodes),
                        functionType,
                    ),
                    numArguments: getArgumentCount(nodeIdMapCollection, activeNode, ancestryIndex),
                };
            } else {
                maybeInvokeExpressionArgs = undefined;
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

function getArgumentTypes(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    typeCache: TypeCache,
    argXorNodes: ReadonlyArray<PQP.Parser.TXorNode>,
): ReadonlyArray<PQP.Language.Type.PowerQueryType> {
    return argXorNodes.map((argXorNode: PQP.Parser.TXorNode) => {
        const argTriedType: TriedType = tryType(
            settings,
            nodeIdMapCollection,
            leafNodeIds,
            argXorNode.node.id,
            typeCache,
        );
        if (PQP.ResultUtils.isError(argTriedType)) {
            throw argTriedType;
        }

        return argTriedType.value;
    });
}

function getArgumentOrdinal(activeNode: ActiveNode, ancestryIndex: number): number {
    const ancestoryCsv: PQP.Parser.TXorNode = PQP.Parser.AncestryUtils.assertGetNthPreviousXor(
        activeNode.ancestry,
        ancestryIndex,
        2,
        [PQP.Language.Ast.NodeKind.Csv],
    );

    return ancestoryCsv.node.maybeAttributeIndex ?? 0;
}

function getArgumentCount(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    activeNode: ActiveNode,
    ancestryIndex: number,
): number {
    const arrayWrapper: PQP.Parser.TXorNode = PQP.Parser.AncestryUtils.assertGetNthPreviousXor(
        activeNode.ancestry,
        ancestryIndex,
        1,
        [PQP.Language.Ast.NodeKind.ArrayWrapper],
    );

    return PQP.Parser.NodeIdMapUtils.assertGetChildren(nodeIdMapCollection.childIdsById, arrayWrapper.node.id).length;
}

function maybeTypeCheckedArguments(
    argTypes: ReadonlyArray<PQP.Language.Type.PowerQueryType>,
    functionType: PQP.Language.Type.PowerQueryType,
): PQP.Language.TypeUtils.CheckedInvocation | undefined {
    return PQP.Language.TypeUtils.isDefinedFunction(functionType)
        ? PQP.Language.TypeUtils.typeCheckInvocation(argTypes, functionType)
        : undefined;
}

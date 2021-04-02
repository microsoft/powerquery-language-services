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
    readonly numArguments: number;
    readonly argumentOrdinal: number;
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

            const triedPreviousNodeType: TriedType = tryType(
                settings,
                nodeIdMapCollection,
                leafNodeIds,
                previousNode.node.id,
                typeCache,
            );
            const functionType: PQP.Language.Type.PowerQueryType = Assert.unwrapOk(triedPreviousNodeType);
            const maybeName: string | undefined = PQP.Parser.NodeIdMapUtils.maybeInvokeExpressionIdentifierLiteral(
                nodeIdMapCollection,
                xorNode.node.id,
            );

            // Try to find out if the identifier is a local or external name.
            let isNameInLocalScope: boolean;
            if (maybeName !== undefined) {
                // Seed local scope
                const scope: NodeScope = Assert.unwrapOk(
                    assertGetOrCreateNodeScope(
                        settings,
                        nodeIdMapCollection,
                        leafNodeIds,
                        xorNode.node.id,
                        typeCache.scopeById,
                    ),
                );
                const maybeNameScopeItem: TScopeItem | undefined = scope.get(maybeName);

                isNameInLocalScope =
                    maybeNameScopeItem !== undefined && maybeNameScopeItem.kind !== ScopeItemKind.Undefined;
            } else {
                isNameInLocalScope = false;
            }

            return {
                xorNode,
                functionType,
                isNameInLocalScope,
                maybeName,
                maybeArguments: inspectInvokeExpressionArguments(nodeIdMapCollection, activeNode, ancestryIndex),
            };
        }
    }

    return undefined;
}

function inspectInvokeExpressionArguments(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    activeNode: ActiveNode,
    nodeIndex: number,
): InvokeExpressionArgs | undefined {
    // Grab arguments if they exist, else return early.
    const maybeCsvArray:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.AncestryUtils.maybePreviousXor(activeNode.ancestry, nodeIndex, [
        PQP.Language.Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeCsvArray === undefined) {
        return undefined;
    }

    const csvArray: PQP.Parser.TXorNode = maybeCsvArray;
    const csvNodes: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.NodeIdMapIterator.assertIterChildrenXor(
        nodeIdMapCollection,
        csvArray.node.id,
    );
    const numArguments: number = csvNodes.length;
    if (numArguments === 0) {
        return undefined;
    }

    const maybeAncestorCsv:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.AncestryUtils.maybeNthPreviousXor(activeNode.ancestry, nodeIndex, 2, [
        PQP.Language.Ast.NodeKind.Csv,
    ]);
    const maybePositionArgumentIndex: number | undefined = maybeAncestorCsv?.node.maybeAttributeIndex;

    return {
        numArguments,
        argumentOrdinal: maybePositionArgumentIndex !== undefined ? maybePositionArgumentIndex : 0,
    };
}

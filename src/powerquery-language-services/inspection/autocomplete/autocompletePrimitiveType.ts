// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { PositionUtils } from "../..";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { TrailingToken, TriedAutocompletePrimitiveType } from "./commonTypes";

export function tryAutocompletePrimitiveType(
    settings: PQP.CommonSettings,
    maybeActiveNode: TMaybeActiveNode,
    maybeTrailingToken: TrailingToken | undefined,
): TriedAutocompletePrimitiveType {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return PQP.ResultUtils.createOk([]);
    }

    return PQP.ResultUtils.ensureResult(settings.locale, () => {
        return autocompletePrimitiveType(maybeActiveNode, maybeTrailingToken?.data);
    });
}

function autocompletePrimitiveType(
    activeNode: ActiveNode,
    maybeTrailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return createAutocompleteItems(traverseAncestors(activeNode), maybeTrailingText);
}

function createAutocompleteItems(
    primitiveTypeConstantKinds: ReadonlyArray<PQP.Language.Constant.PrimitiveTypeConstantKind>,
    maybeTrailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return primitiveTypeConstantKinds.map(
        (primitiveTypeConstantKind: PQP.Language.Constant.PrimitiveTypeConstantKind) =>
            AutocompleteItemUtils.createFromPrimitiveTypeConstantKind(primitiveTypeConstantKind, maybeTrailingText),
    );
}

function traverseAncestors(activeNode: ActiveNode): ReadonlyArray<PQP.Language.Constant.PrimitiveTypeConstantKind> {
    if (activeNode.ancestry.length === 0) {
        return [];
    }

    const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;

    const numAncestors: number = activeNode.ancestry.length;
    for (let index: number = 0; index < numAncestors; index += 1) {
        const parent: PQP.Parser.TXorNode = ancestry[index];
        const maybeChild: PQP.Parser.TXorNode | undefined = ancestry[index - 1];

        // If the node is a context PrimitiveType node,
        // which is created only when a primitive type was expected but there was nothing to parse.
        // `x as |`
        if (
            parent.kind === PQP.Parser.XorNodeKind.Context &&
            parent.node.kind === PQP.Language.Ast.NodeKind.PrimitiveType
        ) {
            return PQP.Language.Constant.PrimitiveTypeConstantKinds;
        }
        // If on the second attribute for TypePrimaryType.
        // `type |`
        else if (parent.node.kind === PQP.Language.Ast.NodeKind.TypePrimaryType) {
            if (maybeChild === undefined) {
                return PQP.Language.Constant.PrimitiveTypeConstantKinds;
            } else if (
                maybeChild.node.maybeAttributeIndex === 0 &&
                maybeChild.kind === PQP.Parser.XorNodeKind.Ast &&
                PositionUtils.isAfterAst(activeNode.position, maybeChild.node as PQP.Language.Ast.TNode, true)
            ) {
                return PQP.Language.Constant.PrimitiveTypeConstantKinds;
            }
        }
        // If on a FunctionExpression parameter.
        else if (
            parent.node.kind === PQP.Language.Ast.NodeKind.Parameter &&
            PQP.Parser.AncestryUtils.maybeNthNextXor(ancestry, index, 4, [
                PQP.Language.Ast.NodeKind.FunctionExpression,
            ]) !== undefined
        ) {
            // Things get messy when testing if it's on a nullable primitive type OR a primitive type.
            const maybeGrandchild: PQP.Parser.TXorNode | undefined = PQP.Parser.AncestryUtils.maybeNthPreviousXor(
                ancestry,
                index,
                2,
                undefined,
            );
            if (maybeGrandchild === undefined) {
                continue;
            }
            // On primitive type.
            // `(x as |) => 0`
            else if (
                maybeGrandchild.kind === PQP.Parser.XorNodeKind.Ast &&
                maybeGrandchild.node.kind === PQP.Language.Ast.NodeKind.Constant &&
                maybeGrandchild.node.constantKind === PQP.Language.Constant.KeywordConstantKind.As &&
                PositionUtils.isAfterAst(activeNode.position, maybeGrandchild.node, true)
            ) {
                return PQP.Language.Constant.PrimitiveTypeConstantKinds;
            }
            // On nullable primitive type
            // `(x as nullable |) => 0`
            else if (maybeGrandchild.node.kind === PQP.Language.Ast.NodeKind.NullablePrimitiveType) {
                const maybeGreatGreatGrandchild:
                    | PQP.Parser.TXorNode
                    | undefined = PQP.Parser.AncestryUtils.maybeNthPreviousXor(ancestry, index, 3, undefined);
                if (maybeGreatGreatGrandchild?.node.kind === PQP.Language.Ast.NodeKind.PrimitiveType) {
                    return PQP.Language.Constant.PrimitiveTypeConstantKinds;
                }
            }
        }
    }

    return [];
}

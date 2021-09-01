// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { AncestryUtils, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

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
        return ResultUtils.boxOk([]);
    }

    return ResultUtils.ensureResult(settings.locale, () => {
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
    primitiveTypeConstantKinds: ReadonlyArray<Constant.PrimitiveTypeConstantKind>,
    maybeTrailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return primitiveTypeConstantKinds.map((primitiveTypeConstantKind: Constant.PrimitiveTypeConstantKind) =>
        AutocompleteItemUtils.createFromPrimitiveTypeConstantKind(primitiveTypeConstantKind, maybeTrailingText),
    );
}

function traverseAncestors(activeNode: ActiveNode): ReadonlyArray<Constant.PrimitiveTypeConstantKind> {
    if (activeNode.ancestry.length === 0) {
        return [];
    }

    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;

    const numAncestors: number = activeNode.ancestry.length;
    for (let index: number = 0; index < numAncestors; index += 1) {
        const parent: TXorNode = ancestry[index];
        const maybeChild: TXorNode | undefined = ancestry[index - 1];

        // If the node is a context PrimitiveType node,
        // which is created only when a primitive type was expected but there was nothing to parse.
        // `x as |`
        if (parent.kind === PQP.Parser.XorNodeKind.Context && parent.node.kind === Ast.NodeKind.PrimitiveType) {
            return Constant.PrimitiveTypeConstantKinds;
        }
        // If on the second attribute for TypePrimaryType.
        // `type |`
        else if (parent.node.kind === Ast.NodeKind.TypePrimaryType) {
            if (maybeChild === undefined) {
                return Constant.PrimitiveTypeConstantKinds;
            } else if (
                maybeChild.node.maybeAttributeIndex === 0 &&
                maybeChild.kind === PQP.Parser.XorNodeKind.Ast &&
                PositionUtils.isAfterAst(activeNode.position, maybeChild.node as Ast.TNode, true)
            ) {
                return Constant.PrimitiveTypeConstantKinds;
            }
        }
        // If on a FunctionExpression parameter.
        else if (
            parent.node.kind === Ast.NodeKind.Parameter &&
            AncestryUtils.maybeNthNextXorChecked(ancestry, index, 4, Ast.NodeKind.FunctionExpression) !== undefined
        ) {
            // Things get messy when testing if it's on a nullable primitive type OR a primitive type.
            const maybeGrandchild: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(ancestry, index, 2);
            if (maybeGrandchild === undefined) {
                continue;
            }
            // On primitive type.
            // `(x as |) => 0`
            else if (
                maybeGrandchild.kind === PQP.Parser.XorNodeKind.Ast &&
                maybeGrandchild.node.kind === Ast.NodeKind.Constant &&
                maybeGrandchild.node.constantKind === Constant.KeywordConstantKind.As &&
                PositionUtils.isAfterAst(activeNode.position, maybeGrandchild.node, true)
            ) {
                return Constant.PrimitiveTypeConstantKinds;
            }
            // On nullable primitive type
            // `(x as nullable |) => 0`
            else if (maybeGrandchild.node.kind === Ast.NodeKind.NullablePrimitiveType) {
                const maybeGreatGreatGrandchild: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
                    ancestry,
                    index,
                    3,
                );
                if (maybeGreatGreatGrandchild?.node.kind === Ast.NodeKind.PrimitiveType) {
                    return Constant.PrimitiveTypeConstantKinds;
                }
            }
        }
    }

    return [];
}

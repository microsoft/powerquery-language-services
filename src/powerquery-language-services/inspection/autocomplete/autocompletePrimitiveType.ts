// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { AncestryUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { AutocompleteTraceConstant, PositionUtils } from "../..";
import { TrailingToken, TriedAutocompletePrimitiveType } from "./commonTypes";

export function tryAutocompletePrimitiveType(
    settings: PQP.CommonSettings,
    maybeActiveNode: TMaybeActiveNode,
    maybeTrailingToken: TrailingToken | undefined,
): TriedAutocompletePrimitiveType {
    const trace: Trace = settings.traceManager.entry(
        AutocompleteTraceConstant.PrimitiveType,
        tryAutocompletePrimitiveType.name,
    );

    let result: TriedAutocompletePrimitiveType;
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        result = ResultUtils.boxOk([]);
    } else {
        result = ResultUtils.ensureResult(settings.locale, () => {
            return autocompletePrimitiveType(maybeActiveNode, maybeTrailingToken?.data);
        });
    }
    trace.exit();

    return result;
}

function autocompletePrimitiveType(
    activeNode: ActiveNode,
    maybeTrailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return createAutocompleteItems(traverseAncestors(activeNode), maybeTrailingText);
}

function createAutocompleteItems(
    PrimitiveTypeConstants: ReadonlyArray<Constant.PrimitiveTypeConstant>,
    maybeTrailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return PrimitiveTypeConstants.map((PrimitiveTypeConstant: Constant.PrimitiveTypeConstant) =>
        AutocompleteItemUtils.createFromPrimitiveTypeConstant(PrimitiveTypeConstant, maybeTrailingText),
    );
}

function traverseAncestors(activeNode: ActiveNode): ReadonlyArray<Constant.PrimitiveTypeConstant> {
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
        if (XorNodeUtils.isContextXorChecked(parent, Ast.NodeKind.PrimitiveType)) {
            return Constant.PrimitiveTypeConstants;
        }
        // If on the second attribute for TypePrimaryType.
        // `type |`
        else if (parent.node.kind === Ast.NodeKind.TypePrimaryType) {
            if (maybeChild === undefined) {
                return Constant.PrimitiveTypeConstants;
            } else if (
                maybeChild.node.maybeAttributeIndex === 0 &&
                XorNodeUtils.isAstXor(maybeChild) &&
                PositionUtils.isAfterAst(activeNode.position, maybeChild.node, true)
            ) {
                return Constant.PrimitiveTypeConstants;
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
                XorNodeUtils.isAstXorChecked<Ast.TConstant>(maybeGrandchild, Ast.NodeKind.Constant) &&
                maybeGrandchild.node.constantKind === Constant.KeywordConstant.As &&
                PositionUtils.isAfterAst(activeNode.position, maybeGrandchild.node, true)
            ) {
                return Constant.PrimitiveTypeConstants;
            }
            // On nullable primitive type
            // `(x as nullable |) => 0`
            else if (
                maybeGrandchild.node.kind === Ast.NodeKind.NullablePrimitiveType &&
                // Check the great grandchild
                AncestryUtils.maybeNthPreviousXorChecked(ancestry, index, 3, Ast.NodeKind.PrimitiveType)
            ) {
                return Constant.PrimitiveTypeConstants;
            }
        }
    }

    return [];
}

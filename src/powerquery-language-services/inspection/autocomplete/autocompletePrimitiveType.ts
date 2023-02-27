// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { AncestryUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ActiveNode, ActiveNodeUtils, TActiveNode } from "../activeNode";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { AutocompleteTraceConstant, PositionUtils } from "../..";
import { TrailingToken, TriedAutocompletePrimitiveType } from "./commonTypes";

export function tryAutocompletePrimitiveType(
    settings: PQP.CommonSettings,
    activeNode: TActiveNode,
    trailingToken: TrailingToken | undefined,
): TriedAutocompletePrimitiveType {
    const trace: Trace = settings.traceManager.entry(
        AutocompleteTraceConstant.AutocompletePrimitiveType,
        tryAutocompletePrimitiveType.name,
        settings.initialCorrelationId,
    );

    let result: TriedAutocompletePrimitiveType;

    if (!ActiveNodeUtils.isPositionInBounds(activeNode)) {
        result = ResultUtils.ok([]);
    } else {
        result = ResultUtils.ensureResult(
            () => autocompletePrimitiveType(activeNode, trailingToken?.data),
            settings.locale,
        );
    }

    trace.exit();

    return result;
}

function autocompletePrimitiveType(
    activeNode: ActiveNode,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return createAutocompleteItems(traverseAncestors(activeNode), trailingText);
}

function createAutocompleteItems(
    PrimitiveTypeConstants: ReadonlyArray<Constant.PrimitiveTypeConstant>,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return PrimitiveTypeConstants.map((PrimitiveTypeConstant: Constant.PrimitiveTypeConstant) =>
        AutocompleteItemUtils.fromPrimitiveTypeConstant(PrimitiveTypeConstant, trailingText),
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
        const child: TXorNode | undefined = ancestry[index - 1];

        // If the node is a context PrimitiveType node,
        // which is created only when a primitive type was expected but there was nothing to parse.
        // `x as |`
        if (XorNodeUtils.isContextXorChecked<Ast.PrimitiveType>(parent, Ast.NodeKind.PrimitiveType)) {
            return Constant.PrimitiveTypeConstants;
        }
        // If on the second attribute for TypePrimaryType.
        // `type |`
        else if (parent.node.kind === Ast.NodeKind.TypePrimaryType) {
            if (child === undefined) {
                return Constant.PrimitiveTypeConstants;
            } else if (
                child.node.attributeIndex === 0 &&
                XorNodeUtils.isAstXor(child) &&
                PositionUtils.isAfterAst(activeNode.position, child.node, true)
            ) {
                return Constant.PrimitiveTypeConstants;
            }
        }
        // If on a FunctionExpression parameter.
        else if (
            parent.node.kind === Ast.NodeKind.Parameter &&
            AncestryUtils.nthNextXorChecked<Ast.FunctionExpression>(
                ancestry,
                index,
                4,
                Ast.NodeKind.FunctionExpression,
            ) !== undefined
        ) {
            // Things get messy when testing if it's on a nullable primitive type OR a primitive type.
            const grandchild: TXorNode | undefined = AncestryUtils.nthPreviousXor(ancestry, index, 2);

            if (grandchild === undefined) {
                continue;
            }
            // On primitive type.
            // `(x as |) => 0`
            else if (
                XorNodeUtils.isAstXorChecked<Ast.TConstant>(grandchild, Ast.NodeKind.Constant) &&
                grandchild.node.constantKind === Constant.KeywordConstant.As &&
                PositionUtils.isAfterAst(activeNode.position, grandchild.node, true)
            ) {
                return Constant.PrimitiveTypeConstants;
            }
            // On nullable primitive type
            // `(x as nullable |) => 0`
            else if (
                grandchild.node.kind === Ast.NodeKind.NullablePrimitiveType &&
                // Check the great grandchild
                AncestryUtils.nthPreviousXorChecked<Ast.PrimitiveType>(ancestry, index, 3, Ast.NodeKind.PrimitiveType)
            ) {
                return Constant.PrimitiveTypeConstants;
            }
        }
    }

    return [];
}

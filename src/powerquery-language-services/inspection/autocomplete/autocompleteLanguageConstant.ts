// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import type { Position } from "vscode-languageserver-types";

import { ActiveNode, ActiveNodeLeafKind, ActiveNodeUtils, TActiveNode } from "../activeNode";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { AutocompleteTraceConstant, PositionUtils } from "../..";
import { TrailingToken, TriedAutocompleteLanguageConstant } from "./commonTypes";

export function tryAutocompleteLanguageConstant(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: TActiveNode,
    trailingToken: TrailingToken | undefined,
): TriedAutocompleteLanguageConstant {
    const trace: Trace = settings.traceManager.entry(
        AutocompleteTraceConstant.AutocompleteLanguageConstant,
        tryAutocompleteLanguageConstant.name,
        settings.initialCorrelationId,
    );

    const result: TriedAutocompleteLanguageConstant = ResultUtils.ensureResult(
        () => autocompleteLanguageConstant(nodeIdMapCollection, activeNode, trailingToken),
        settings.locale,
    );

    trace.exit({ [TraceConstant.IsError]: ResultUtils.isError(result) });

    return result;
}

function autocompleteLanguageConstant(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: TActiveNode,
    trailingToken: TrailingToken | undefined,
): AutocompleteItem | undefined {
    if (!ActiveNodeUtils.isPositionInBounds(activeNode)) {
        return undefined;
    }

    if (isCatchAllowed(nodeIdMapCollection, activeNode, trailingToken)) {
        return AutocompleteItemUtils.fromLanguageConstant(Constant.LanguageConstant.Catch);
    } else if (isNullableAllowed(activeNode)) {
        return AutocompleteItemUtils.fromLanguageConstant(Constant.LanguageConstant.Nullable);
    } else if (isOptionalAllowed(activeNode)) {
        return AutocompleteItemUtils.fromLanguageConstant(Constant.LanguageConstant.Optional);
    } else {
        return undefined;
    }
}

function isCatchAllowed(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): boolean {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestry[index];

        if (
            // We are under an ErrorHandlingExpression
            xorNode.node.kind === Ast.NodeKind.ErrorHandlingExpression &&
            // Which was fully parsed
            XorNodeUtils.isAstXor(xorNode) &&
            // Yet the cursor is after the end of the Ast
            activeNode.leafKind === ActiveNodeLeafKind.AfterAstNode &&
            // And it only has two children, meaning it hasn't parsed an error handler
            NodeIdMapUtils.assertGetChildren(nodeIdMapCollection.childIdsById, xorNode.node.id).length === 2
        ) {
            return trailingToken ? Constant.LanguageConstant.Catch.startsWith(trailingToken.data) : true;
        }
    }

    return false;
}

function isNullableAllowed(activeNode: ActiveNode): boolean {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestry[index];

        switch (xorNode.node.kind) {
            case Ast.NodeKind.AsNullablePrimitiveType:
                if (isNullableAllowedForAsNullablePrimitiveType(activeNode, index)) {
                    return true;
                }

                break;

            case Ast.NodeKind.PrimitiveType:
                if (XorNodeUtils.isContextXor(xorNode)) {
                    return true;
                }

                break;

            default:
                continue;
        }
    }

    return false;
}

function isNullableAllowedForAsNullablePrimitiveType(activeNode: ActiveNode, ancestryIndex: number): boolean {
    const child: TXorNode | undefined = AncestryUtils.previousXor(activeNode.ancestry, ancestryIndex);

    if (child?.node.attributeIndex !== 1) {
        return false;
    }

    // Ast.AsNullablePrimitiveType.paired: Ast.TNullablePrimitiveType
    const paired: TXorNode = child;
    const position: Position = activeNode.position;

    // Ast.PrimitiveType
    if (paired.node.kind === Ast.NodeKind.PrimitiveType && PositionUtils.isBeforeXor(position, paired, false)) {
        return true;
    }
    // Ast.NullablePrimitiveType
    else if (paired.node.kind === Ast.NodeKind.NullablePrimitiveType) {
        const grandchild: TXorNode | undefined = AncestryUtils.nthPreviousXor(activeNode.ancestry, ancestryIndex, 2);

        if (grandchild === undefined) {
            return false;
        }

        return (
            // Ast.Constant
            grandchild.node.kind === Ast.NodeKind.Constant ||
            // before Ast.PrimitiveType
            PositionUtils.isBeforeXor(position, grandchild, false)
        );
    } else if (paired.node.kind === Ast.NodeKind.PrimitiveType) {
        return XorNodeUtils.isContextXor(paired);
    } else {
        return false;
    }
}

function isOptionalAllowed(activeNode: ActiveNode): boolean {
    const fnExprAncestryIndex: number | undefined = AncestryUtils.findIndexOfNodeKind(
        activeNode.ancestry,
        Ast.NodeKind.FunctionExpression,
    );

    if (fnExprAncestryIndex === undefined) {
        return false;
    }

    // FunctionExpression -> IParenthesisWrapped -> ParameterList -> Csv -> Parameter
    const parameter: XorNode<Ast.TParameter> | undefined = AncestryUtils.nthPreviousXorChecked<Ast.TParameter>(
        activeNode.ancestry,
        fnExprAncestryIndex,
        4,
        Ast.NodeKind.Parameter,
    );

    if (parameter === undefined) {
        return false;
    }

    const childOfParameter: TXorNode | undefined = AncestryUtils.nthPreviousXor(
        activeNode.ancestry,
        fnExprAncestryIndex,
        5,
    );

    if (childOfParameter === undefined) {
        return true;
    }

    switch (childOfParameter.node.attributeIndex) {
        // IParameter.optionalConstant
        case 0:
            return true;

        // IParameter.name
        case 1:
            switch (childOfParameter.kind) {
                case PQP.Parser.XorNodeKind.Ast: {
                    const nameAst: Ast.Identifier = XorNodeUtils.assertUnboxAstChecked<Ast.Identifier>(
                        childOfParameter,
                        Ast.NodeKind.Identifier,
                    );

                    const name: string = nameAst.literal;

                    return (
                        Constant.LanguageConstant.Optional.startsWith(name) &&
                        name !== Constant.LanguageConstant.Optional &&
                        PositionUtils.isInAst(activeNode.position, nameAst, false, true)
                    );
                }

                case PQP.Parser.XorNodeKind.Context:
                    return true;

                default:
                    throw Assert.isNever(childOfParameter);
            }

        default:
            return false;
    }
}

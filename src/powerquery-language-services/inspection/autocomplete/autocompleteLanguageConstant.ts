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
import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Position, Range, TextEdit } from "vscode-languageserver-types";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { LanguageConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";

import { ActiveNode, ActiveNodeLeafKind, ActiveNodeUtils, TActiveNode } from "../activeNode";
import { AutocompleteTraceConstant, calculateJaroWinkler, CompletionItemKind, PositionUtils } from "../..";
import { AutocompleteItem } from "./autocompleteItem";
import { TrailingToken } from "./trailingToken";
import { TriedAutocompleteLanguageConstant } from "./commonTypes";

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
): ReadonlyArray<AutocompleteItem> {
    if (!ActiveNodeUtils.isPositionInBounds(activeNode)) {
        return [];
    }

    const result: AutocompleteItem[] = [];

    if (isCatchAllowed(nodeIdMapCollection, activeNode, trailingToken)) {
        result.push(createAutocompleteItem(LanguageConstant.Catch));
    }

    const nullableAutocompleteItem: AutocompleteItem | undefined = getNullableAutocompleteItem(
        activeNode,
        trailingToken,
    );

    const optionalAutocompleteItem: AutocompleteItem | undefined = getOptionalAutocompleteItem(activeNode);

    if (nullableAutocompleteItem) {
        result.push(nullableAutocompleteItem);
    }

    if (optionalAutocompleteItem) {
        result.push(optionalAutocompleteItem);
    }

    return result;
}

export function createAutocompleteItem(
    label: LanguageConstant,
    other?: string,
    range?: Range | undefined,
): AutocompleteItem {
    const jaroWinklerScore: number = other !== undefined ? calculateJaroWinkler(label, other) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Keyword,
        label,
        powerQueryType: Type.NotApplicableInstance,
        textEdit: range ? TextEdit.replace(range, label) : undefined,
    };
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
            XorNodeUtils.isAst(xorNode) &&
            // Yet the cursor is after the end of the Ast
            activeNode.leafKind === ActiveNodeLeafKind.IsBeforePosition &&
            // And it only has two children, meaning it hasn't parsed an error handler
            NodeIdMapUtils.assertChildIds(nodeIdMapCollection.childIdsById, xorNode.node.id).length === 2
        ) {
            return trailingToken ? LanguageConstant.Catch.startsWith(trailingToken.data) : true;
        }
    }

    return false;
}

function getNullableAutocompleteItem(
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): AutocompleteItem | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestry[index];

        switch (xorNode.node.kind) {
            case Ast.NodeKind.AsNullablePrimitiveType:
                if (isNullableAllowedForAsNullablePrimitiveType(activeNode, index)) {
                    return createAutocompleteItem(LanguageConstant.Nullable);
                }

                break;

            case Ast.NodeKind.PrimitiveType:
                if (XorNodeUtils.isContext(xorNode)) {
                    if (!trailingToken) {
                        return createAutocompleteItem(LanguageConstant.Nullable);
                    } else if (PositionUtils.isInToken(activeNode.position, trailingToken, true, true)) {
                        return createAutocompleteItem(
                            LanguageConstant.Nullable,
                            trailingToken.data,
                            PositionUtils.rangeFromToken(trailingToken),
                        );
                    }
                }

                break;

            default:
                continue;
        }
    }

    return undefined;
}

function isNullableAllowedForAsNullablePrimitiveType(activeNode: ActiveNode, ancestryIndex: number): boolean {
    const child: TXorNode | undefined = AncestryUtils.nth(activeNode.ancestry, ancestryIndex - 1);

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
        const grandchild: TXorNode | undefined = AncestryUtils.nth(activeNode.ancestry, ancestryIndex - 2);

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
        return XorNodeUtils.isContext(paired);
    } else {
        return false;
    }
}

function getOptionalAutocompleteItem(activeNode: ActiveNode): AutocompleteItem | undefined {
    const fnExprAncestryIndex: number | undefined = AncestryUtils.indexOfNodeKind<Ast.FunctionExpression>(
        activeNode.ancestry,
        Ast.NodeKind.FunctionExpression,
    );

    if (fnExprAncestryIndex === undefined) {
        return undefined;
    }

    // FunctionExpression -> IParenthesisWrapped -> ParameterList -> Csv -> Parameter
    const parameterAncestryIndex: number = fnExprAncestryIndex - 4;

    const parameter: XorNode<Ast.TParameter> | undefined = AncestryUtils.nthChecked<Ast.TParameter>(
        activeNode.ancestry,
        parameterAncestryIndex,
        Ast.NodeKind.Parameter,
    );

    if (parameter === undefined) {
        return undefined;
    }

    const childOfParameter: TXorNode | undefined = AncestryUtils.nth(activeNode.ancestry, parameterAncestryIndex - 1);

    if (childOfParameter === undefined) {
        return createAutocompleteItem(LanguageConstant.Optional);
    }

    switch (childOfParameter.node.attributeIndex) {
        // IParameter.optionalConstant
        case 0:
            switch (childOfParameter.kind) {
                case PQP.Parser.XorNodeKind.Ast: {
                    const optionalConstant: Ast.TConstant = XorNodeUtils.assertAstChecked<Ast.TConstant>(
                        childOfParameter,
                        Ast.NodeKind.Constant,
                    );

                    return createAutocompleteItem(
                        LanguageConstant.Optional,
                        optionalConstant.constantKind,
                        PositionUtils.rangeFromTokenRange(optionalConstant.tokenRange),
                    );
                }

                case PQP.Parser.XorNodeKind.Context:
                    return createAutocompleteItem(LanguageConstant.Optional);

                default:
                    throw Assert.isNever(childOfParameter);
            }

        // IParameter.name
        case 1:
            switch (childOfParameter.kind) {
                case PQP.Parser.XorNodeKind.Ast: {
                    const parameterName: Ast.Identifier = XorNodeUtils.assertAstChecked<Ast.Identifier>(
                        childOfParameter,
                        Ast.NodeKind.Identifier,
                    );

                    return createAutocompleteItem(
                        LanguageConstant.Optional,
                        parameterName.literal,
                        PositionUtils.rangeFromTokenRange(parameterName.tokenRange),
                    );
                }

                case PQP.Parser.XorNodeKind.Context:
                    return createAutocompleteItem(LanguageConstant.Optional);

                default:
                    throw Assert.isNever(childOfParameter);
            }

        default:
            return undefined;
    }
}

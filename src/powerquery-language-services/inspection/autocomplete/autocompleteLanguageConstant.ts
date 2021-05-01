// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { Position } from "vscode-languageserver-types";
import { PositionUtils } from "../..";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { TriedAutocompleteLanguageConstant } from "./commonTypes";

export function tryAutocompleteLanguageConstant(
    settings: PQP.CommonSettings,
    maybeActiveNode: TMaybeActiveNode,
): TriedAutocompleteLanguageConstant {
    return PQP.ResultUtils.ensureResult(settings.locale, () => {
        return autocompleteLanguageConstant(maybeActiveNode);
    });
}

function autocompleteLanguageConstant(maybeActiveNode: TMaybeActiveNode): AutocompleteItem | undefined {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return undefined;
    }
    const activeNode: ActiveNode = maybeActiveNode;

    if (isNullableAllowed(activeNode)) {
        return AutocompleteItemUtils.createFromLanguageConstantKind(
            PQP.Language.Constant.LanguageConstantKind.Nullable,
        );
    } else if (isOptionalAllowed(activeNode)) {
        return AutocompleteItemUtils.createFromLanguageConstantKind(
            PQP.Language.Constant.LanguageConstantKind.Optional,
        );
    } else {
        return undefined;
    }
}

function isNullableAllowed(activeNode: ActiveNode): boolean {
    const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: PQP.Parser.TXorNode = ancestry[index];

        switch (xorNode.node.kind) {
            case PQP.Language.Ast.NodeKind.AsNullablePrimitiveType:
                if (isNullableAllowedForAsNullablePrimitiveType(activeNode, index)) {
                    return true;
                }
                break;

            case PQP.Language.Ast.NodeKind.PrimitiveType:
                if (isNullableAllowedForPrimitiveType(xorNode)) {
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
    const maybeChild: PQP.Parser.TXorNode | undefined = PQP.Parser.AncestryUtils.maybePreviousXor(
        activeNode.ancestry,
        ancestryIndex,
    );
    if (maybeChild?.node.maybeAttributeIndex !== 1) {
        return false;
    }
    // PQP.Language.Ast.AsNullablePrimitiveType.paired: PQP.Language.Ast.TNullablePrimitiveType
    const paired: PQP.Parser.TXorNode = maybeChild;
    const position: Position = activeNode.position;

    // PQP.Language.Ast.PrimitiveType
    if (
        paired.node.kind === PQP.Language.Ast.NodeKind.PrimitiveType &&
        PositionUtils.isBeforeXor(position, paired, false)
    ) {
        return true;
    }
    // PQP.Language.Ast.NullablePrimitiveType
    else if (paired.node.kind === PQP.Language.Ast.NodeKind.NullablePrimitiveType) {
        const maybeGrandchild: PQP.Parser.TXorNode | undefined = PQP.Parser.AncestryUtils.maybeNthPreviousXor(
            activeNode.ancestry,
            ancestryIndex,
            2,
        );
        if (maybeGrandchild === undefined) {
            return false;
        }
        // PQP.Language.Ast.Constant || PQP.Language.Ast.PrimitiveType
        const grandchild: PQP.Parser.TXorNode = maybeGrandchild;

        return (
            // PQP.Language.Ast.Constant
            grandchild.node.kind === PQP.Language.Ast.NodeKind.Constant ||
            // before PQP.Language.Ast.PrimitiveType
            PositionUtils.isBeforeXor(position, grandchild, false)
        );
    } else if (paired.node.kind === PQP.Language.Ast.NodeKind.PrimitiveType) {
        return isNullableAllowedForPrimitiveType(paired);
    } else {
        return false;
    }
}

function isNullableAllowedForPrimitiveType(primitiveType: PQP.Parser.TXorNode): boolean {
    return primitiveType.kind === PQP.Parser.XorNodeKind.Context;
}

function isOptionalAllowed(activeNode: ActiveNode): boolean {
    const maybeFnExprAncestryIndex: number | undefined = PQP.Parser.AncestryUtils.maybeFirstIndexOfNodeKind(
        activeNode.ancestry,
        PQP.Language.Ast.NodeKind.FunctionExpression,
    );
    if (maybeFnExprAncestryIndex === undefined) {
        return false;
    }
    const fnExprAncestryIndex: number = maybeFnExprAncestryIndex;

    // FunctionExpression -> IParenthesisWrapped -> ParameterList -> Csv -> Parameter
    const maybeParameter:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.AncestryUtils.maybeNthPreviousXor(activeNode.ancestry, fnExprAncestryIndex, 4, [
        PQP.Language.Ast.NodeKind.Parameter,
    ]);
    if (maybeParameter === undefined) {
        return false;
    }

    const maybeChildOfParameter: PQP.Parser.TXorNode | undefined = PQP.Parser.AncestryUtils.maybeNthPreviousXor(
        activeNode.ancestry,
        fnExprAncestryIndex,
        5,
    );
    if (maybeChildOfParameter === undefined) {
        return true;
    }
    const childOfParameter: PQP.Parser.TXorNode = maybeChildOfParameter;

    switch (childOfParameter.node.maybeAttributeIndex) {
        // IParameter.maybeOptionalConstant
        case 0:
            return true;

        // IParameter.name
        case 1:
            switch (childOfParameter.kind) {
                case PQP.Parser.XorNodeKind.Ast: {
                    const nameAst: PQP.Language.Ast.Identifier = childOfParameter.node as PQP.Language.Ast.Identifier;
                    const name: string = nameAst.literal;

                    return (
                        PQP.Language.Constant.LanguageConstantKind.Optional.startsWith(name) &&
                        name !== PQP.Language.Constant.LanguageConstantKind.Optional &&
                        PositionUtils.isInAst(activeNode.position, nameAst, false, true)
                    );
                }

                case PQP.Parser.XorNodeKind.Context:
                    return true;

                default:
                    throw PQP.Assert.isNever(childOfParameter);
            }

        default:
            return false;
    }
}

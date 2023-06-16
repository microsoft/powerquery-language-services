/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Constant, TextUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    PrimitiveTypeConstant,
    PrimitiveTypeConstants,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ActiveNode, ActiveNodeUtils, TActiveNode } from "../activeNode";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { AutocompleteTraceConstant, PositionUtils } from "../..";
import { TriedAutocompletePrimitiveType } from "./commonTypes";
import { TrailingToken } from "./trailingToken";

export function tryAutocompletePrimitiveType(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
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
            () =>
                autocompletePrimitiveType(
                    nodeIdMapCollection,
                    activeNode,
                    trailingToken?.data && TextUtils.isRegularIdentifier(trailingToken.data, true)
                        ? trailingToken.data
                        : undefined,
                ),
            settings.locale,
        );
    }

    trace.exit();

    return result;
}

const AllowedPrimitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant> = PrimitiveTypeConstants.filter(
    (constant: PrimitiveTypeConstant) => constant !== PrimitiveTypeConstant.None,
);

function autocompletePrimitiveType(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    if (activeNode.ancestry.length === 0) {
        return [];
    }

    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const child: TXorNode = AncestryUtils.assertFirst(ancestry);

    if (XorNodeUtils.isNodeKind<Ast.PrimitiveType>(child, Ast.NodeKind.PrimitiveType)) {
        const parent: TXorNode | undefined = AncestryUtils.nth(activeNode.ancestry, 1);

        if (parent === undefined) {
            return [];
        } else if (
            XorNodeUtils.isNodeKind<Ast.AsExpression | Ast.IsExpression>(parent, [
                Ast.NodeKind.AsExpression,
                Ast.NodeKind.IsExpression,
            ])
        ) {
            return inspectEitherAsExpressionOrIsExpression(
                nodeIdMapCollection,
                parent,
                child,
                activeNode,
                trailingText,
            );
        } else if (XorNodeUtils.isNodeKind<Ast.AsNullablePrimitiveType>(parent, Ast.NodeKind.AsNullablePrimitiveType)) {
            return inspectAsNullablePrimitiveType(nodeIdMapCollection, parent, child, activeNode, trailingText);
        } else {
            return inspectPrimitiveType(child, activeNode, trailingText);
        }
    } else if (XorNodeUtils.isNodeKind<Ast.TypePrimaryType>(child, Ast.NodeKind.TypePrimaryType)) {
        return inspectTypePrimaryType(nodeIdMapCollection, child, activeNode, trailingText);
    }

    return [];
}

function createAutocompleteItems(
    primitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant>,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return primitiveTypeConstants.map((primitiveTypeConstant: PrimitiveTypeConstant) =>
        AutocompleteItemUtils.fromPrimitiveTypeConstant(primitiveTypeConstant, trailingText),
    );
}

function createAutocompleteItemsFromPrimitiveTypeConstant(
    primitiveTypeConstant: Constant.PrimitiveTypeConstant,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return createAutocompleteItems(
        AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) => value.startsWith(primitiveTypeConstant)),
        trailingText,
    );
}

function createAutocompleteItemsFromTrailingText(trailingText: string | undefined): ReadonlyArray<AutocompleteItem> {
    return createAutocompleteItems(
        trailingText
            ? AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) => value.startsWith(trailingText))
            : AllowedPrimitiveTypeConstants,
        trailingText,
    );
}

function inspectAsNullablePrimitiveType(
    nodeIdMapCollection: NodeIdMap.Collection,
    asNullablePrimitiveType: XorNode<Ast.AsNullablePrimitiveType>,
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    const asConstant: Ast.TConstant | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
        nodeIdMapCollection,
        asNullablePrimitiveType.node.id,
        0,
        Ast.NodeKind.Constant,
    );

    if (
        asConstant == undefined ||
        PositionUtils.isBeforeTokenPosition(activeNode.position, asConstant.tokenRange.positionEnd, false)
    ) {
        return [];
    }

    if (XorNodeUtils.isAst(primitiveType)) {
        const primitiveTypeConstant: Ast.PrimitiveType = primitiveType.node;

        if (PositionUtils.isAfterAst(activeNode.position, primitiveTypeConstant, true)) {
            return [];
        } else if (PositionUtils.isOnAstEnd(activeNode.position, primitiveTypeConstant)) {
            return createAutocompleteItemsFromPrimitiveTypeConstant(
                primitiveTypeConstant.primitiveTypeKind,
                trailingText,
            );
        } else if (PositionUtils.isBeforeAst(activeNode.position, primitiveTypeConstant, false)) {
            return createAutocompleteItems(AllowedPrimitiveTypeConstants, undefined);
        }
    }

    return createAutocompleteItemsFromTrailingText(trailingText);
}

function inspectEitherAsExpressionOrIsExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    eitherAsExpressionOrIsExpression: XorNode<Ast.AsExpression | Ast.IsExpression>,
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    const eitherAsConstantOrIsConstant: Ast.TConstant = NodeIdMapUtils.assertNthChildAstChecked<Ast.TConstant>(
        nodeIdMapCollection,
        eitherAsExpressionOrIsExpression.node.id,
        1,
        Ast.NodeKind.Constant,
    );

    // No autocomplete is available for an Ast unless the cursor is at the end of the primitive type.
    // Eg `1 is date|`
    if (XorNodeUtils.isAst(primitiveType)) {
        const primitiveTypeConstant: Ast.PrimitiveType = primitiveType.node;

        if (PositionUtils.isOnAstEnd(activeNode.position, primitiveTypeConstant)) {
            return createAutocompleteItemsFromPrimitiveTypeConstant(
                primitiveTypeConstant.primitiveTypeKind,
                trailingText,
            );
        }

        return [];
    } else {
        // `1 is|`
        if (PositionUtils.isOnAstEnd(activeNode.position, eitherAsConstantOrIsConstant)) {
            return [];
        }

        return createAutocompleteItemsFromTrailingText(trailingText);
    }
}

function inspectPrimitiveType(
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    if (XorNodeUtils.isAst(primitiveType)) {
        const primitiveTypeConstant: PrimitiveTypeConstant = primitiveType.node.primitiveTypeKind;

        if (PositionUtils.isOnAstEnd(activeNode.position, primitiveType.node)) {
            return createAutocompleteItemsFromPrimitiveTypeConstant(primitiveTypeConstant, primitiveTypeConstant);
        } else {
            return [];
        }
    } else {
        return createAutocompleteItemsFromTrailingText(trailingText);
    }
}

function inspectTypePrimaryType(
    nodeIdMapCollection: NodeIdMap.Collection,
    typePrimaryType: XorNode<Ast.TypePrimaryType>,
    activeNode: ActiveNode,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    const typeConstant: XorNode<Ast.IConstant<Constant.KeywordConstant.Type>> | undefined =
        NodeIdMapUtils.nthChildXorChecked<Ast.IConstant<Constant.KeywordConstant.Type>>(
            nodeIdMapCollection,
            typePrimaryType.node.id,
            0,
            Ast.NodeKind.Constant,
        );

    const primaryType: XorNode<Ast.TPrimaryType> | undefined = NodeIdMapUtils.nthChildXorChecked<Ast.TPrimaryType>(
        nodeIdMapCollection,
        typePrimaryType.node.id,
        1,
        [
            Ast.NodeKind.PrimitiveType,
            Ast.NodeKind.FunctionType,
            Ast.NodeKind.ListType,
            Ast.NodeKind.NullableType,
            Ast.NodeKind.RecordType,
            Ast.NodeKind.TableType,
        ],
    );

    if (typeConstant === undefined) {
        return [];
    } else if (primaryType === undefined) {
        return createAutocompleteItemsFromTrailingText(trailingText);
    } else if (
        !XorNodeUtils.isAst(typeConstant) ||
        PositionUtils.isBeforeTokenPosition(activeNode.position, typeConstant.node.tokenRange.positionEnd, false)
    ) {
        return [];
    } else if (XorNodeUtils.isAst(typePrimaryType)) {
        if (PositionUtils.isBeforeAst(activeNode.position, typeConstant.node, false)) {
            return createAutocompleteItems(AllowedPrimitiveTypeConstants, undefined);
        }
    }

    return [];
}

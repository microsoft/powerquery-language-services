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
import { Ast, AstUtils, Constant, TextUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    PrimitiveTypeConstant,
    PrimitiveTypeConstants,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ActiveNode, ActiveNodeUtils, TActiveNode } from "../activeNode";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { AutocompleteTraceConstant, PositionUtils } from "../..";
import { TriedAutocompletePrimitiveType } from "./commonTypes";
import { TrailingToken, TokenPositionComparison } from "./trailingToken";

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
            () => autocompletePrimitiveType(nodeIdMapCollection, activeNode, trailingToken),
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
    trailingToken: TrailingToken | undefined,
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
                trailingToken,
            );
        } else if (XorNodeUtils.isNodeKind<Ast.AsNullablePrimitiveType>(parent, Ast.NodeKind.AsNullablePrimitiveType)) {
            return inspectAsNullablePrimitiveType(nodeIdMapCollection, parent, child, activeNode, trailingToken);
        }
        if (XorNodeUtils.isNodeKind<Ast.NullablePrimitiveType>(parent, Ast.NodeKind.NullablePrimitiveType)) {
            return inspectNullablePrimitiveType(child, activeNode, trailingToken);
        } else {
            return inspectPrimitiveType(child, activeNode, trailingToken);
        }
    } else if (XorNodeUtils.isNodeKind<Ast.TypePrimaryType>(child, Ast.NodeKind.TypePrimaryType)) {
        return inspectTypePrimaryType(nodeIdMapCollection, child, activeNode, trailingToken);
    }

    return [];
}

function createAutocompleteItems(
    primitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant>,
    other: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return primitiveTypeConstants.map((primitiveTypeConstant: PrimitiveTypeConstant) =>
        AutocompleteItemUtils.fromPrimitiveTypeConstant(primitiveTypeConstant, other),
    );
}

// `any` returns ["any", "anynonnull"]
// `date` returns ["date", "datetime", "datetimezone"]
// etc.
function createAutocompleteItemsForPrimitiveTypeConstant(
    primitiveTypeConstant: Constant.PrimitiveTypeConstant,
): ReadonlyArray<AutocompleteItem> {
    return createAutocompleteItems(
        AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) => value.startsWith(primitiveTypeConstant)),
        undefined,
    );
}

// Returns AllowedPrimitiveTypeConstants if one of the following:
//  - there is no trailing token
//  - the Position is either on or to the left of the trailing token
// Else we either:
//  - return an empty array if we're not on the trailing token
//  - else we return the autocomplete items for the trailing text
function createAutocompleteItemsForTrailingToken(
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    if (!trailingToken || trailingToken.tokenStartComparison !== TokenPositionComparison.RightOfToken) {
        return createDefaultAutocompleteItems();
    } else if (trailingToken.tokenEndComparison !== TokenPositionComparison.OnToken) {
        return [];
    }

    const trailingText: string = trailingToken.data;

    return createAutocompleteItems(
        AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) => value.startsWith(trailingText)),
        trailingText,
    );
}

function createDefaultAutocompleteItems(): ReadonlyArray<AutocompleteItem> {
    return createAutocompleteItems(AllowedPrimitiveTypeConstants, undefined);
}

function inspectAsNullablePrimitiveType(
    nodeIdMapCollection: NodeIdMap.Collection,
    asNullablePrimitiveType: XorNode<Ast.AsNullablePrimitiveType>,
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    // Ast
    if (XorNodeUtils.isAst(asNullablePrimitiveType)) {
        const nullablePrimitiveType: Ast.TNullablePrimitiveType = asNullablePrimitiveType.node.paired;

        // if NullablePrimitiveType
        if (AstUtils.isNodeKind<Ast.NullablePrimitiveType>(nullablePrimitiveType, Ast.NodeKind.NullablePrimitiveType)) {
            return inspectNullablePrimitiveType(
                XorNodeUtils.boxAst(nullablePrimitiveType.paired),
                activeNode,
                trailingToken,
            );
        }
        // Else PrimitiveType
        else {
            return inspectPrimitiveType(XorNodeUtils.boxAst(nullablePrimitiveType), activeNode, trailingToken);
        }
    } else {
        const asConstant: Ast.TConstant | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
            nodeIdMapCollection,
            asNullablePrimitiveType.node.id,
            0,
            [Ast.NodeKind.Constant],
        );

        if (asConstant === undefined || !PositionUtils.isAfterAst(activeNode.position, asConstant, true)) {
            return [];
        }

        return inspectPrimitiveType(primitiveType, activeNode, trailingToken);
    }
}

function inspectEitherAsExpressionOrIsExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    eitherAsExpressionOrIsExpression: XorNode<Ast.AsExpression | Ast.IsExpression>,
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    // No autocomplete is available for an Ast unless the cursor is at the end of the primitive type.
    // Eg `1 is date|`
    if (XorNodeUtils.isAst(primitiveType)) {
        if (!PositionUtils.isOnAstEnd(activeNode.position, primitiveType.node)) {
            return [];
        }

        return createAutocompleteItemsForPrimitiveTypeConstant(primitiveType.node.primitiveTypeKind);
    } else {
        const eitherAsConstantOrIsConstant: Ast.TConstant = NodeIdMapUtils.assertNthChildAstChecked<Ast.TConstant>(
            nodeIdMapCollection,
            eitherAsExpressionOrIsExpression.node.id,
            1,
            Ast.NodeKind.Constant,
        );

        // `1 is|`
        if (PositionUtils.isOnAstEnd(activeNode.position, eitherAsConstantOrIsConstant)) {
            return [];
        }

        return createAutocompleteItemsForTrailingToken(trailingToken);
    }
}

function inspectNullablePrimitiveType(
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    // Ast
    if (XorNodeUtils.isAst(primitiveType)) {
        if (!PositionUtils.isOnAstEnd(activeNode.position, primitiveType.node)) {
            return [];
        }

        return createAutocompleteItemsForPrimitiveTypeConstant(primitiveType.node.primitiveTypeKind);
    }
    // ParseContext
    else {
        return createAutocompleteItemsForTrailingToken(trailingToken);
    }
}

function inspectPrimitiveType(
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    // Ast
    if (XorNodeUtils.isAst(primitiveType)) {
        if (!PositionUtils.isOnAstEnd(activeNode.position, primitiveType.node)) {
            return [];
        }

        return createAutocompleteItemsForPrimitiveTypeConstant(primitiveType.node.primitiveTypeKind);
    }
    // ParseContext
    else {
        return createAutocompleteItemsForTrailingToken(trailingToken);
    }
}

function inspectTypePrimaryType(
    nodeIdMapCollection: NodeIdMap.Collection,
    typePrimaryType: XorNode<Ast.TypePrimaryType>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    const typeConstant: XorNode<Ast.IConstant<Constant.KeywordConstant.Type>> | undefined =
        NodeIdMapUtils.nthChildXorChecked<Ast.IConstant<Constant.KeywordConstant.Type>>(
            nodeIdMapCollection,
            typePrimaryType.node.id,
            0,
            Ast.NodeKind.Constant,
        );

    if (
        typeConstant === undefined ||
        !XorNodeUtils.isAst(typeConstant) ||
        !PositionUtils.isAfterAst(activeNode.position, typeConstant.node, true)
    ) {
        return [];
    }

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

    if (primaryType === undefined) {
        return createAutocompleteItemsForTrailingToken(trailingToken);
    }
    // Ast
    else if (XorNodeUtils.isAst(primaryType)) {
        if (!PositionUtils.isOnAstEnd(activeNode.position, primaryType.node)) {
            return [];
        } else if (AstUtils.isNodeKind<Ast.PrimitiveType>(primaryType.node, Ast.NodeKind.PrimitiveType)) {
            return createAutocompleteItemsForPrimitiveTypeConstant(primaryType.node.primitiveTypeKind);
        } else {
            return [];
        }
    }

    throw new PQP.CommonError.InvariantError("this should never be reached");
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, AstUtils, Constant, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { CommonError, CommonSettings, ResultUtils, Trace } from "@microsoft/powerquery-parser";
import {
    PrimitiveTypeConstant,
    PrimitiveTypeConstants,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";

import { ActiveNode, ActiveNodeUtils, TActiveNode } from "../activeNode";
import {
    AutocompleteTraceConstant,
    calculateJaroWinkler,
    CompletionItemKind,
    PositionUtils,
    Range,
    TextEdit,
} from "../..";
import { AutocompleteItem } from "./autocompleteItem";
import { TrailingToken } from "./trailingToken";
import { TriedAutocompletePrimitiveType } from "./commonTypes";

export function tryAutocompletePrimitiveType(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: TActiveNode,
    trailingToken: TrailingToken | undefined,
): TriedAutocompletePrimitiveType {
    const trace: Trace.Trace = settings.traceManager.entry(
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
        } else if (XorNodeUtils.isNodeKind<Ast.NullablePrimitiveType>(parent, Ast.NodeKind.NullablePrimitiveType)) {
            return inspectNullablePrimitiveType(child, activeNode, trailingToken);
        } else {
            return inspectPrimitiveType(child, activeNode, trailingToken);
        }
    } else if (XorNodeUtils.isNodeKind<Ast.TypePrimaryType>(child, Ast.NodeKind.TypePrimaryType)) {
        return inspectTypePrimaryType(nodeIdMapCollection, child, activeNode, trailingToken);
    }

    return [];
}

function createAutocompleteItemReplacements(existingText: string, range: Range): ReadonlyArray<AutocompleteItem> {
    return AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) => value.includes(existingText)).map(
        (value: PrimitiveTypeConstant) =>
            autocompleteItemFromPrimitiveTypeConstant(value, existingText, TextEdit.replace(range, value)),
    );
}

export function autocompleteItemFromPrimitiveTypeConstant(
    label: Constant.PrimitiveTypeConstant,
    other?: string,
    textEdit?: TextEdit,
): AutocompleteItem {
    const jaroWinklerScore: number = other !== undefined ? calculateJaroWinkler(label, other) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Keyword,
        label,
        powerQueryType: TypeUtils.primitiveType(
            label === Constant.PrimitiveTypeConstant.Null,
            TypeUtils.typeKindFromPrimitiveTypeConstantKind(label),
        ),
        textEdit,
    };
}

function createAutocompleteItems(
    primitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant>,
    other: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return primitiveTypeConstants.map((primitiveTypeConstant: PrimitiveTypeConstant) =>
        autocompleteItemFromPrimitiveTypeConstant(primitiveTypeConstant, other),
    );
}

// `any` returns ["any", "anynonnull"]
// `date` returns ["date", "datetime", "datetimezone"]
// etc.
function createAutocompleteItemsForPrimitiveTypeConstant(
    primitiveType: Ast.PrimitiveType,
): ReadonlyArray<AutocompleteItem> {
    return createAutocompleteItemReplacements(
        primitiveType.primitiveTypeKind,
        Range.create(
            PositionUtils.positionFromTokenPosition(primitiveType.tokenRange.positionStart),
            PositionUtils.positionFromTokenPosition(primitiveType.tokenRange.positionEnd),
        ),
    );
}

// Returns AllowedPrimitiveTypeConstants if either:
//  - there is no trailing token
//  - the Position is either on or to the left of the trailing token's start
// elif Position is not on the trailing token's end, then return an empty array
// else return the autocomplete items for the trailing text.
function createAutocompleteItemsForTrailingToken(
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    if (!trailingToken) {
        return createDefaultAutocompleteItems();
    } else if (!trailingToken.isPositionEitherInOrOnToken) {
        return [];
    } else {
        return createAutocompleteItemReplacements(
            trailingToken.data,
            Range.create(
                PositionUtils.positionFromTokenPosition(trailingToken.positionStart),
                PositionUtils.positionFromTokenPosition(trailingToken.positionEnd),
            ),
        );
    }
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
    }
    // ParseContext
    else {
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
    // Ast
    if (XorNodeUtils.isAst(primitiveType)) {
        if (!PositionUtils.isOnAstEnd(activeNode.position, primitiveType.node)) {
            return [];
        }

        return createAutocompleteItemsForPrimitiveTypeConstant(primitiveType.node);
    }
    // ParseContext
    else {
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

        return createAutocompleteItemsForPrimitiveTypeConstant(primitiveType.node);
    }
    // ParseContext
    // This should only show up in CombinatorialParserV2 if `nullable` was parsed but there was no PrimitiveType.
    // If a TrailingToken exists then it's either a partially typed primitive type:
    //  - Eg. `(val as nullable num|) => val` would have a TrailingToken for `num`
    // Or it's some random unrelated token which should be ignored.
    //  - Eg. `(val as nullable |) => val` would have a TrailingToken for `)`
    else if (!trailingToken) {
        return createDefaultAutocompleteItems();
    } else if (!trailingToken.isPositionEitherInOrOnToken) {
        return [];
    } else {
        const trailingText: string = trailingToken.data;

        const primitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant> = AllowedPrimitiveTypeConstants.filter(
            (value: PrimitiveTypeConstant) => value.includes(trailingText),
        );

        if (primitiveTypeConstants.length) {
            const range: Range = Range.create(
                PositionUtils.positionFromTokenPosition(trailingToken.positionStart),
                PositionUtils.positionFromTokenPosition(trailingToken.positionEnd),
            );

            return primitiveTypeConstants.map((value: PrimitiveTypeConstant) =>
                autocompleteItemFromPrimitiveTypeConstant(value, trailingText, TextEdit.replace(range, value)),
            );
        } else {
            return AllowedPrimitiveTypeConstants.map((value: PrimitiveTypeConstant) =>
                autocompleteItemFromPrimitiveTypeConstant(value),
            );
        }
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

        return createAutocompleteItemsForPrimitiveTypeConstant(primitiveType.node);
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
        if (
            !PositionUtils.isOnAstEnd(activeNode.position, primaryType.node) ||
            !AstUtils.isNodeKind<Ast.PrimitiveType>(primaryType.node, Ast.NodeKind.PrimitiveType)
        ) {
            return [];
        }

        return createAutocompleteItemsForPrimitiveTypeConstant(primaryType.node);
    }

    throw new CommonError.InvariantError("this should never be reached");
}

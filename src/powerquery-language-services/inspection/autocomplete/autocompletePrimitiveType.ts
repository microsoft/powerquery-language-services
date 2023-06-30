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
import { Assert, CommonError, CommonSettings, ResultUtils, Trace } from "@microsoft/powerquery-parser";
import { Ast, AstUtils, Constant, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
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
    const child: TXorNode = AncestryUtils.assertNth(ancestry, 0);

    if (XorNodeUtils.isNodeKind<Ast.FieldTypeSpecification>(child, Ast.NodeKind.FieldTypeSpecification)) {
        return inspectFieldTypeSpecification(nodeIdMapCollection, child, activeNode, trailingToken);
    } else if (XorNodeUtils.isNodeKind<Ast.NullableType>(child, Ast.NodeKind.NullableType)) {
        return inspectNullableType(nodeIdMapCollection, child, activeNode, trailingToken);
    } else if (XorNodeUtils.isNodeKind<Ast.PrimitiveType>(child, Ast.NodeKind.PrimitiveType)) {
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
            return inspectNullablePrimitiveType(nodeIdMapCollection, parent, child, activeNode, trailingToken);
        } else {
            return inspectPrimitiveType(child, activeNode, trailingToken);
        }
    } else if (XorNodeUtils.isNodeKind<Ast.TypePrimaryType>(child, Ast.NodeKind.TypePrimaryType)) {
        return inspectTypePrimaryType(nodeIdMapCollection, child, activeNode, trailingToken);
    } else {
        return [];
    }
}

// Defaults to insertion if range is undefined,
// otherwise replaces the range with the label.
function createAutocompleteItems(
    text?: string | undefined,
    range?: Range | undefined,
): ReadonlyArray<AutocompleteItem> {
    return AllowedPrimitiveTypeConstants.map((label: PrimitiveTypeConstant) => {
        const jaroWinklerScore: number = text !== undefined ? calculateJaroWinkler(label, text) : 1;

        return {
            jaroWinklerScore,
            kind: CompletionItemKind.Keyword,
            label,
            powerQueryType: TypeUtils.primitiveType(
                label === Constant.PrimitiveTypeConstant.Null,
                TypeUtils.typeKindFromPrimitiveTypeConstantKind(label),
            ),
            textEdit: range ? TextEdit.replace(range, label) : undefined,
        };
    });
}

function createAutocompleteItemsFromIdentifierExpression(
    identifierExpression: Ast.IdentifierExpression,
    activeNode: ActiveNode,
): ReadonlyArray<AutocompleteItem> {
    if (identifierExpression.inclusiveConstant) {
        return [];
    }

    const literal: string = identifierExpression.identifier.literal;

    if (
        !isSubstringOfPrimitiveTypeConstant(literal) ||
        !PositionUtils.isInAst(activeNode.position, identifierExpression, true, true)
    ) {
        return [];
    }

    return createAutocompleteItems(
        literal,
        Range.create(
            PositionUtils.positionFromTokenPosition(identifierExpression.tokenRange.positionStart),
            PositionUtils.positionFromTokenPosition(identifierExpression.tokenRange.positionEnd),
        ),
    );
}

// `any` returns ["any", "anynonnull"]
// `date` returns ["date", "datetime", "datetimezone"]
// etc.
function createAutocompleteItemsFromPrimitiveTypeConstant(
    primitiveType: Ast.PrimitiveType,
    activeNode: ActiveNode,
): ReadonlyArray<AutocompleteItem> {
    if (!PositionUtils.isInAst(activeNode.position, primitiveType, true, true)) {
        return [];
    }

    return createAutocompleteItems(
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
function createAutocompleteItemsFromTrailingToken(
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    if (!trailingToken) {
        return createAutocompleteItems();
    } else if (!trailingToken.isPositionEitherInOrOnToken) {
        return [];
    } else {
        return createAutocompleteItems(
            trailingToken.data,
            Range.create(
                PositionUtils.positionFromTokenPosition(trailingToken.positionStart),
                PositionUtils.positionFromTokenPosition(trailingToken.positionEnd),
            ),
        );
    }
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

        switch (nullablePrimitiveType.kind) {
            case Ast.NodeKind.NullablePrimitiveType:
                return inspectNullablePrimitiveType(
                    nodeIdMapCollection,
                    XorNodeUtils.boxAst(nullablePrimitiveType),
                    XorNodeUtils.boxAst(nullablePrimitiveType.paired),
                    activeNode,
                    trailingToken,
                );

            case Ast.NodeKind.PrimitiveType:
                return inspectPrimitiveType(XorNodeUtils.boxAst(nullablePrimitiveType), activeNode, trailingToken);

            default:
                throw Assert.isNever(nullablePrimitiveType);
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

        const nullablePrimitiveType: XorNode<Ast.TNullablePrimitiveType> | undefined =
            NodeIdMapUtils.nthChildXorChecked<Ast.TNullablePrimitiveType>(
                nodeIdMapCollection,
                asNullablePrimitiveType.node.id,
                1,
                [Ast.NodeKind.NullablePrimitiveType, Ast.NodeKind.PrimitiveType],
            );

        if (nullablePrimitiveType === undefined) {
            return [];
        } else if (
            XorNodeUtils.isNodeKind<Ast.NullablePrimitiveType>(
                nullablePrimitiveType,
                Ast.NodeKind.NullablePrimitiveType,
            )
        ) {
            return inspectNullablePrimitiveType(
                nodeIdMapCollection,
                nullablePrimitiveType,
                primitiveType,
                activeNode,
                trailingToken,
            );
        } else if (XorNodeUtils.isNodeKind<Ast.PrimitiveType>(nullablePrimitiveType, Ast.NodeKind.PrimitiveType)) {
            return inspectPrimitiveType(nullablePrimitiveType, activeNode, trailingToken);
        } else {
            throw new CommonError.InvariantError(`expected either a NullablePrimitiveType or PrimitiveType`, {
                nodeKind: nullablePrimitiveType.node.kind,
            });
        }
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
        return createAutocompleteItemsFromPrimitiveTypeConstant(primitiveType.node, activeNode);
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

        return createAutocompleteItemsFromTrailingToken(trailingToken);
    }
}

function inspectFieldTypeSpecification(
    nodeIdMapCollection: NodeIdMap.Collection,
    fieldTypeSpecification: XorNode<Ast.FieldTypeSpecification>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    // Ast
    if (XorNodeUtils.isAst(fieldTypeSpecification)) {
        const fieldType: Ast.TType = fieldTypeSpecification.node.fieldType;

        if (!PositionUtils.isInAst(activeNode.position, fieldType, true, true)) {
            return [];
        } else if (AstUtils.isNodeKind<Ast.PrimitiveType>(fieldType, Ast.NodeKind.PrimitiveType)) {
            return inspectPrimitiveType(XorNodeUtils.boxAst(fieldType), activeNode, trailingToken);
        } else if (AstUtils.isNodeKind<Ast.IdentifierExpression>(fieldType, Ast.NodeKind.IdentifierExpression)) {
            return createAutocompleteItemsFromIdentifierExpression(fieldType, activeNode);
        }
    }
    // ParseContext
    else {
        const equalConstant: Ast.TConstant | undefined = NodeIdMapUtils.assertNthChildAstChecked<Ast.TConstant>(
            nodeIdMapCollection,
            fieldTypeSpecification.node.id,
            0,
            Ast.NodeKind.Constant,
        );

        if (equalConstant === undefined || !PositionUtils.isAfterAst(activeNode.position, equalConstant, false)) {
            return [];
        }

        const ttype: TXorNode | undefined = NodeIdMapUtils.nthChildXor(
            nodeIdMapCollection,
            fieldTypeSpecification.node.id,
            1,
        );

        if (ttype === undefined) {
            return createAutocompleteItems();
        } else if (XorNodeUtils.isTType(ttype)) {
            return inspectTType(ttype, activeNode, trailingToken);
        }
    }

    return [];
}

function inspectNullablePrimitiveType(
    nodeIdMapCollection: NodeIdMap.Collection,
    nullablePrimitiveType: XorNode<Ast.NullablePrimitiveType>,
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    // Ast
    if (XorNodeUtils.isAst(primitiveType)) {
        return inspectPrimitiveType(primitiveType, activeNode, undefined);
    }
    // ParseContext
    else if (!trailingToken) {
        return createAutocompleteItems();
    } else if (!trailingToken.isPositionEitherInOrOnToken) {
        return [];
    } else {
        const nullableConstant: Ast.TConstant | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
            nodeIdMapCollection,
            nullablePrimitiveType.node.id,
            0,
            [Ast.NodeKind.Constant],
        );

        if (nullableConstant === undefined || !PositionUtils.isAfterAst(activeNode.position, nullableConstant, true)) {
            return [];
        } else {
            return inspectPrimitiveType(primitiveType, activeNode, trailingToken);
        }
    }
}

function inspectNullableType(
    nodeIdMapCollection: NodeIdMap.Collection,
    nullableType: XorNode<Ast.NullableType>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    // Ast
    if (XorNodeUtils.isAst(nullableType)) {
        // `type nullable date|`
        if (AstUtils.isNodeKind<Ast.PrimitiveType>(nullableType.node.paired, Ast.NodeKind.PrimitiveType)) {
            return inspectPrimitiveType(XorNodeUtils.boxAst(nullableType.node.paired), activeNode, trailingToken);
        }
        // `type nullable a|`
        else if (
            AstUtils.isNodeKind<Ast.IdentifierExpression>(nullableType.node.paired, Ast.NodeKind.IdentifierExpression)
        ) {
            return createAutocompleteItemsFromIdentifierExpression(nullableType.node.paired, activeNode);
        } else {
            return [];
        }
    }
    // ParseContext
    else {
        const nullableConstant: Ast.TConstant | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
            nodeIdMapCollection,
            nullableType.node.id,
            0,
            [Ast.NodeKind.Constant],
        );

        if (nullableConstant === undefined || !PositionUtils.isAfterAst(activeNode.position, nullableConstant, true)) {
            return [];
        } else {
            const primitiveType: XorNode<Ast.LiteralExpression | Ast.PrimitiveType> | undefined =
                NodeIdMapUtils.nthChildXorChecked<Ast.LiteralExpression | Ast.PrimitiveType>(
                    nodeIdMapCollection,
                    nullableType.node.id,
                    1,
                    [Ast.NodeKind.LiteralExpression, Ast.NodeKind.PrimitiveType],
                );

            if (primitiveType === undefined) {
                return [];
            }
            // The parser defaults to having thrown on a LiteralExpression if nothing trails afterwords,
            // eg. `type nullable |`
            else if (XorNodeUtils.isNodeKind<Ast.LiteralExpression>(primitiveType, Ast.NodeKind.LiteralExpression)) {
                return createAutocompleteItems();
            } else if (XorNodeUtils.isNodeKind<Ast.PrimitiveType>(primitiveType, Ast.NodeKind.PrimitiveType)) {
                return inspectPrimitiveType(primitiveType, activeNode, trailingToken);
            } else {
                return [];
            }
        }
    }
}

function inspectPrimitiveType(
    primitiveTypeXor: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    // Ast
    if (XorNodeUtils.isAst(primitiveTypeXor)) {
        if (!PositionUtils.isInAst(activeNode.position, primitiveTypeXor.node, true, true)) {
            return [];
        }

        const primitiveTypeAst: Ast.PrimitiveType = primitiveTypeXor.node;
        const primitiveTypeKind: Constant.PrimitiveTypeConstant = primitiveTypeAst.primitiveTypeKind;

        return createAutocompleteItems(
            primitiveTypeKind,
            Range.create(
                PositionUtils.positionFromTokenPosition(primitiveTypeAst.tokenRange.positionStart),
                PositionUtils.positionFromTokenPosition(primitiveTypeAst.tokenRange.positionEnd),
            ),
        );
    }
    // ParseContext
    else if (trailingToken) {
        const trailingText: string = trailingToken.data;

        if (isSubstringOfPrimitiveTypeConstant(trailingText)) {
            return createAutocompleteItems(
                trailingText,
                Range.create(
                    PositionUtils.positionFromTokenPosition(trailingToken.positionStart),
                    PositionUtils.positionFromTokenPosition(trailingToken.positionEnd),
                ),
            );
        }
    }

    return createAutocompleteItems();
}

function inspectTType(
    ttype: XorNode<Ast.TType>,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> {
    // Ast
    if (XorNodeUtils.isAst(ttype)) {
        // `type nullable date|`
        if (AstUtils.isNodeKind<Ast.PrimitiveType>(ttype.node, Ast.NodeKind.PrimitiveType)) {
            return inspectPrimitiveType(XorNodeUtils.boxAst(ttype.node), activeNode, trailingToken);
        }
        // `type nullable a|`
        else if (AstUtils.isNodeKind<Ast.IdentifierExpression>(ttype.node, Ast.NodeKind.IdentifierExpression)) {
            return createAutocompleteItemsFromIdentifierExpression(ttype.node, activeNode);
        }
    }
    // ParseContext
    // The parser defaults to having thrown on a LiteralExpression if nothing trails afterwords,
    // eg. `type nullable |`
    else if (XorNodeUtils.isNodeKind<Ast.LiteralExpression>(ttype, Ast.NodeKind.LiteralExpression)) {
        return createAutocompleteItems();
    } else if (XorNodeUtils.isNodeKind<Ast.PrimitiveType>(ttype, Ast.NodeKind.PrimitiveType)) {
        return inspectPrimitiveType(ttype, activeNode, trailingToken);
    }

    return [];
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
        return createAutocompleteItemsFromTrailingToken(trailingToken);
    }
    // Ast
    else if (XorNodeUtils.isAst(primaryType)) {
        if (
            !PositionUtils.isOnAstEnd(activeNode.position, primaryType.node) ||
            !AstUtils.isNodeKind<Ast.PrimitiveType>(primaryType.node, Ast.NodeKind.PrimitiveType)
        ) {
            return [];
        }

        return createAutocompleteItemsFromPrimitiveTypeConstant(primaryType.node, activeNode);
    } else {
        return [];
    }
}

function isSubstringOfPrimitiveTypeConstant(text: string): boolean {
    return AllowedPrimitiveTypeConstants.some((value: PrimitiveTypeConstant) => value.includes(text));
}

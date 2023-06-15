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
import { ArrayUtils, CommonError, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Constant, TextUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    PrimitiveTypeConstant,
    PrimitiveTypeConstants,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ActiveNode, ActiveNodeUtils, TActiveNode } from "../activeNode";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { AutocompleteTraceConstant, Position, PositionUtils } from "../..";
import { TrailingToken, TriedAutocompletePrimitiveType } from "./commonTypes";

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
    return traverseAncestors(nodeIdMapCollection, activeNode, trailingText);
}

function createAutocompleteItems(
    primitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant>,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return primitiveTypeConstants.map((primitiveTypeConstant: PrimitiveTypeConstant) =>
        AutocompleteItemUtils.fromPrimitiveTypeConstant(primitiveTypeConstant, trailingText),
    );
}

function traverseAncestors(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    if (activeNode.ancestry.length === 0) {
        return [];
    }

    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = activeNode.ancestry.length;

    const xorNode: TXorNode = AncestryUtils.assertGetLeaf(ancestry);

    if (XorNodeUtils.isNodeKind<Ast.PrimitiveType>(xorNode, Ast.NodeKind.PrimitiveType)) {
        return inspectPrimitiveType(nodeIdMapCollection, xorNode, activeNode, trailingText);
    } else if (XorNodeUtils.isNodeKind<Ast.TypePrimaryType>(xorNode, Ast.NodeKind.TypePrimaryType)) {
        return inspectTypePrimaryType(nodeIdMapCollection, xorNode, activeNode, trailingText);
    }

    return [];
}

function inspectPrimitiveType(
    nodeIdMapCollection: NodeIdMap.Collection,
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    if (XorNodeUtils.isAst(primitiveType)) {
        const primitiveTypeConstant: PrimitiveTypeConstant = primitiveType.node.primitiveTypeKind;

        if (PositionUtils.isOnAstEnd(activeNode.position, primitiveType.node)) {
            return createAutocompleteItems(
                AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) =>
                    value.startsWith(primitiveTypeConstant),
                ),
                primitiveTypeConstant,
            );
        } else {
            return [];
        }
    }

    const parent: TXorNode | undefined = AncestryUtils.nextXor(activeNode.ancestry, 0);

    if (parent) {
        if (
            XorNodeUtils.isNodeKind<Ast.AsExpression | Ast.IsExpression>(parent, [
                Ast.NodeKind.AsExpression,
                Ast.NodeKind.IsExpression,
            ])
        ) {
            const constantUnderParent: Ast.TConstant = NodeIdMapUtils.assertNthChildAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                parent.node.id,
                1,
                Ast.NodeKind.Constant,
            );

            if (PositionUtils.isOnAstEnd(activeNode.position, constantUnderParent)) {
                return [];
            }

            return createAutocompleteItems(
                trailingText
                    ? AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) =>
                          value.startsWith(trailingText),
                      )
                    : AllowedPrimitiveTypeConstants,
                trailingText,
            );
        } else if (XorNodeUtils.isNodeKind<Ast.AsNullablePrimitiveType>(parent, Ast.NodeKind.AsNullablePrimitiveType)) {
            const asConstant: Ast.TConstant | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                parent.node.id,
                0,
                Ast.NodeKind.Constant,
            );

            if (asConstant == undefined || PositionUtils.isOnAstEnd(activeNode.position, asConstant)) {
                return [];
            }

            return createAutocompleteItems(
                trailingText
                    ? AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) =>
                          value.startsWith(trailingText),
                      )
                    : AllowedPrimitiveTypeConstants,
                trailingText,
            );
        } else if (XorNodeUtils.isNodeKind<Ast.NullablePrimitiveType>(parent, Ast.NodeKind.NullablePrimitiveType)) {
            if (XorNodeUtils.isNodeKind<Ast.NullablePrimitiveType>(parent, Ast.NodeKind.NullablePrimitiveType)) {
                const nullableConstant: Ast.TConstant | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
                    nodeIdMapCollection,
                    parent.node.id,
                    0,
                    Ast.NodeKind.Constant,
                );

                if (nullableConstant === undefined || PositionUtils.isOnAstEnd(activeNode.position, nullableConstant)) {
                    return [];
                }

                const primitiveType: XorNode<Ast.PrimitiveType> | undefined =
                    NodeIdMapUtils.nthChildXorChecked<Ast.PrimitiveType>(
                        nodeIdMapCollection,
                        parent.node.id,
                        1,
                        Ast.NodeKind.PrimitiveType,
                    );

                // If a context hasn't even been created yet.
                if (primitiveType === undefined) {
                    return createAutocompleteItems(AllowedPrimitiveTypeConstants, trailingText);
                } else {
                    if (XorNodeUtils.isAst(primitiveType)) {
                        const primitiveTypeConstant: PrimitiveTypeConstant = primitiveType.node.primitiveTypeKind;

                        if (PositionUtils.isOnAstEnd(activeNode.position, primitiveType.node)) {
                            return createAutocompleteItems(
                                AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) =>
                                    value.startsWith(primitiveTypeConstant),
                                ),
                                primitiveTypeConstant,
                            );
                        } else {
                            return [];
                        }
                    }

                    return createAutocompleteItems(
                        trailingText
                            ? AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) =>
                                  value.startsWith(trailingText),
                              )
                            : AllowedPrimitiveTypeConstants,
                        trailingText,
                    );
                }
            }
        }
    }

    throw new Error();
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
        return createAutocompleteItems(
            trailingText
                ? AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) => value.startsWith(trailingText))
                : AllowedPrimitiveTypeConstants,
            trailingText,
        );
    } else if (
        !XorNodeUtils.isAst(typeConstant) ||
        PositionUtils.isBeforeTokenPosition(activeNode.position, typeConstant.node.tokenRange.positionEnd, false)
    ) {
        return [];
    } else if (XorNodeUtils.isAst(typePrimaryType)) {
        if (PositionUtils.isBeforeAst(activeNode.position, typeConstant.node, false)) {
            return createAutocompleteItems(AllowedPrimitiveTypeConstants, undefined);
        } else if (PositionUtils.isOnAstEnd(activeNode.position, typeConstant.node)) {
            return createAutocompleteItems(
                AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) =>
                    value.startsWith(typeConstant.node.constantKind),
                ),
                typeConstant.node.constantKind,
            );
        }
    }

    throw new Error();
}

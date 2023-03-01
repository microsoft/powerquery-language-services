/* eslint-disable @typescript-eslint/no-unused-vars */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapUtils,
    ParseContext,
    ParseContextUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { ArrayUtils, CommonError, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, AstUtils, Constant, TextUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
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

    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestry[index];

        // It holds an AsNullablePrimitiveType, so we might be able to do some code re-use.
        if (XorNodeUtils.isNodeKind<Ast.TParameter>(xorNode, Ast.NodeKind.Parameter)) {
            // Check if we're in the context of a parameter's type.
            const asNullablePrimitiveType: XorNode<Ast.AsNullablePrimitiveType> | undefined =
                AncestryUtils.previousXorChecked<Ast.AsNullablePrimitiveType>(ancestry, index, [
                    Ast.NodeKind.AsNullablePrimitiveType,
                ]);

            // If so, time for some code re-use
            if (asNullablePrimitiveType) {
                return inspectAsNullablePrimitiveType(
                    asNullablePrimitiveType,
                    nodeIdMapCollection,
                    activeNode,
                    index - 1,
                    trailingText,
                );
            }
        } else if (
            XorNodeUtils.isNodeKind<Ast.AsNullablePrimitiveType>(xorNode, Ast.NodeKind.AsNullablePrimitiveType)
        ) {
            return inspectAsNullablePrimitiveType(xorNode, nodeIdMapCollection, activeNode, index, trailingText);
        }
    }

    return [];
}

function inspectAsNullablePrimitiveType(
    asNullablePrimitiveType: XorNode<Ast.AsNullablePrimitiveType>,
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    ancestryIndex: number,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;

    const asConstant: Ast.TConstant | undefined = NodeIdMapUtils.unboxNthChildIfAstChecked<Ast.TConstant>(
        nodeIdMapCollection,
        asNullablePrimitiveType.node.id,
        0,
        Ast.NodeKind.Constant,
    );

    if (asConstant == undefined || PositionUtils.isOnAstEnd(activeNode.position, asConstant)) {
        return [];
    }

    const nullablePrimitiveTypeOrPrimitiveType: XorNode<Ast.TNullablePrimitiveType> =
        XorNodeUtils.assertAsNodeKind<Ast.TNullablePrimitiveType>(ArrayUtils.assertGet(ancestry, ancestryIndex - 1), [
            Ast.NodeKind.NullablePrimitiveType,
            Ast.NodeKind.PrimitiveType,
        ]);

    // If NullablePrimitiveType
    if (
        XorNodeUtils.isNodeKind<Ast.NullablePrimitiveType>(
            nullablePrimitiveTypeOrPrimitiveType,
            Ast.NodeKind.NullablePrimitiveType,
        )
    ) {
        const nullableConstant: Ast.TConstant | undefined = NodeIdMapUtils.unboxNthChildIfAstChecked<Ast.TConstant>(
            nodeIdMapCollection,
            nullablePrimitiveTypeOrPrimitiveType.node.id,
            0,
            Ast.NodeKind.Constant,
        );

        if (nullableConstant === undefined || PositionUtils.isOnAstEnd(activeNode.position, nullableConstant)) {
            return [];
        }

        const primitiveType: XorNode<Ast.PrimitiveType> | undefined = NodeIdMapUtils.nthChildChecked<Ast.PrimitiveType>(
            nodeIdMapCollection,
            nullablePrimitiveTypeOrPrimitiveType.node.id,
            1,
            Ast.NodeKind.PrimitiveType,
        );

        // If a context hasn't even been created yet.
        if (primitiveType === undefined) {
            return createAutocompleteItems(AllowedPrimitiveTypeConstants, trailingText);
        } else {
            return inspectPrimitiveType(primitiveType, activeNode, trailingText);
        }
    }
    // Else if PrimitiveType
    else if (
        XorNodeUtils.isNodeKind<Ast.PrimitiveType>(nullablePrimitiveTypeOrPrimitiveType, Ast.NodeKind.PrimitiveType)
    ) {
        return inspectPrimitiveType(nullablePrimitiveTypeOrPrimitiveType, activeNode, trailingText);
    } else {
        throw new CommonError.InvariantError(
            `nullablePrimitiveTypeOrPrimitiveType is neither nullablePrimitive nor primitiveType`,
            { nodeKind: nullablePrimitiveTypeOrPrimitiveType.node.kind },
        );
    }
}

function inspectPrimitiveType(
    primitiveType: XorNode<Ast.PrimitiveType>,
    activeNode: ActiveNode,
    trailingText: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    if (XorNodeUtils.isAstXor(primitiveType)) {
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
            ? AllowedPrimitiveTypeConstants.filter((value: PrimitiveTypeConstant) => value.startsWith(trailingText))
            : AllowedPrimitiveTypeConstants,
        trailingText,
    );
}

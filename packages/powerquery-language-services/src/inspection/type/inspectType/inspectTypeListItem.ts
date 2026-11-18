// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { DereferencedIdentifierKind, TDereferencedIdentifier } from "../../dereferencedIdentifier";
import { InspectTypeState, InspectTypeStateUtils } from "./inspectTypeState";
import { inspectTypeFromChildAttributeIndex } from "./common";
import { ScopeItemKind } from "../../scope";
import { tryBuildDereferencedIdentifierPath } from "../../dereferencedIdentifier/dereferencedIdentifierUtils";

export async function inspectListIndex(
    state: InspectTypeState,
    itemAccess: TXorNode,
    correlationId: number,
): Promise<number | undefined> {
    const type: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, itemAccess, 1, correlationId);

    return TypeUtils.isNumberLiteral(type) &&
        !type.isNullable &&
        Number.isSafeInteger(type.normalizedLiteral) &&
        type.normalizedLiteral >= 0
        ? type.normalizedLiteral
        : undefined;
}

// null means a known missing item; undefined means the source is not a supported list expression.
// Returning a node defers inference until the requested item is actually selected.
export async function tryGetListItem(
    state: InspectTypeState,
    source: TXorNode,
    index: number,
    trace: Trace,
    visited: Set<number> = new Set(),
): Promise<TXorNode | Type.TPowerQueryType | null | undefined> {
    let current: TXorNode | undefined = source;

    while (current !== undefined && XorNodeUtils.isAst(current)) {
        state.cancellationToken?.throwIfCancelled();

        if (visited.has(current.node.id)) {
            return Type.AnyInstance;
        }

        visited.add(current.node.id);

        switch (current.node.kind) {
            case Ast.NodeKind.ParenthesizedExpression:
                current = NodeIdMapUtils.nthChildXor(state.nodeIdMapCollection, current.node.id, 1);
                break;

            case Ast.NodeKind.LetExpression:
                current = NodeIdMapUtils.nthChildXor(state.nodeIdMapCollection, current.node.id, 3);
                break;

            case Ast.NodeKind.Identifier:
            case Ast.NodeKind.IdentifierExpression:
                {
                    const path: ReadonlyArray<TDereferencedIdentifier> = ResultUtils.assertOk(
                        // eslint-disable-next-line no-await-in-loop
                        await tryBuildDereferencedIdentifierPath(
                            InspectTypeStateUtils.toInspectionSettings(state, trace),
                            state.nodeIdMapCollection,
                            current,
                            state.scopeById,
                        ),
                    );

                    const last: TDereferencedIdentifier | undefined = path[path.length - 1];

                    // Reuse external resolution if item access falls back to the collection's type.
                    if (last?.kind === DereferencedIdentifierKind.External) {
                        state.typeById.set(current.node.id, last.type);
                    } else if (last?.kind === DereferencedIdentifierKind.Undefined) {
                        state.typeById.set(current.node.id, Type.UnknownInstance);
                    }

                    if (last?.kind !== DereferencedIdentifierKind.InScopeValue) {
                        return undefined;
                    }

                    switch (last.scopeItem.kind) {
                        case ScopeItemKind.LetVariable:
                        case ScopeItemKind.RecordField:
                        case ScopeItemKind.SectionMember:
                            current = last.scopeItem.value;
                            break;

                        default:
                            return undefined;
                    }
                }

                break;

            case Ast.NodeKind.RecursivePrimaryExpression: {
                const wrapper: TXorNode | undefined = NodeIdMapUtils.nthChildXor(
                    state.nodeIdMapCollection,
                    current.node.id,
                    1,
                );

                const children: ReadonlyArray<TXorNode> = wrapper
                    ? NodeIdMapIterator.assertIterChildrenXor(state.nodeIdMapCollection, wrapper.node.id)
                    : [];

                current = children[children.length - 1];
                break;
            }

            case Ast.NodeKind.ItemAccessExpression: {
                // eslint-disable-next-line no-await-in-loop
                const innerIndex: number | undefined = await inspectListIndex(state, current, trace.id);

                if (innerIndex === undefined) {
                    return undefined;
                }

                // eslint-disable-next-line no-await-in-loop
                const item: TXorNode | Type.TPowerQueryType | null | undefined = await tryGetListItem(
                    state,
                    NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(state.nodeIdMapCollection, current.node.id),
                    innerIndex,
                    trace,
                    new Set(visited),
                );

                if (item === undefined || item === null || !("node" in item)) {
                    return undefined;
                }

                current = item;
                break;
            }

            case Ast.NodeKind.ListExpression:
            case Ast.NodeKind.ListLiteral:
                for (const item of NodeIdMapIterator.iterListItems(state.nodeIdMapCollection, current)) {
                    state.cancellationToken?.throwIfCancelled();

                    if (item.node.kind !== Ast.NodeKind.RangeExpression) {
                        if (index === 0) {
                            return item;
                        }

                        index -= 1;

                        continue;
                    }

                    // eslint-disable-next-line no-await-in-loop
                    const startType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(
                        state,
                        item,
                        0,
                        trace.id,
                    );

                    // eslint-disable-next-line no-await-in-loop
                    const endType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(
                        state,
                        item,
                        2,
                        trace.id,
                    );

                    if (
                        !TypeUtils.isNumberLiteral(startType) ||
                        !TypeUtils.isNumberLiteral(endType) ||
                        startType.isNullable ||
                        endType.isNullable ||
                        !Number.isSafeInteger(startType.normalizedLiteral) ||
                        !Number.isSafeInteger(endType.normalizedLiteral)
                    ) {
                        return Type.AnyInstance;
                    }

                    const start: number = startType.normalizedLiteral;
                    const length: number = Math.max(0, endType.normalizedLiteral - start + 1);

                    if (!Number.isSafeInteger(length)) {
                        return Type.AnyInstance;
                    } else if (index < length) {
                        return TypeUtils.numberLiteral(false, start + index);
                    }

                    index -= length;
                }

                return null;

            default:
                return undefined;
        }
    }

    return undefined;
}

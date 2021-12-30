// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { IInvokeExpression, InvokeExpressionArguments } from "./common";
import { InvokeExpression, TriedInvokeExpression, tryInvokeExpression } from "./invokeExpression";
import { TypeCache, TypeCacheUtils } from "../typeCache";
import { InspectionSettings } from "../../inspectionSettings";

// An inspection of the inner most invoke expression for an ActiveNode.
export type TriedCurrentInvokeExpression = PQP.Result<CurrentInvokeExpression | undefined, PQP.CommonError.CommonError>;

// Identical to InvokeExpression except maybeArguments has an extra field, `argumentOrdinal`.
export type CurrentInvokeExpression = IInvokeExpression<CurrentInvokeExpressionArguments>;

export interface CurrentInvokeExpressionArguments extends InvokeExpressionArguments {
    readonly argumentOrdinal: number;
}

export function tryCurrentInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeActiveNode: TMaybeActiveNode,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): TriedCurrentInvokeExpression {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return ResultUtils.boxOk(undefined);
    }

    return ResultUtils.ensureResult(settings.locale, () =>
        inspectInvokeExpression(settings, nodeIdMapCollection, maybeActiveNode, typeCache),
    );
}

function inspectInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    typeCache: TypeCache,
): CurrentInvokeExpression | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;

    const maybeInvokeExpression: [TXorNode, number] | undefined = AncestryUtils.maybeFirstXorAndIndexOfNodeKind(
        ancestry,
        Ast.NodeKind.InvokeExpression,
    );

    if (!maybeInvokeExpression) {
        return undefined;
    }

    const [invokeExpressionXorNode, ancestryIndex]: [TXorNode, number] = maybeInvokeExpression;
    const triedInvokeExpression: TriedInvokeExpression = tryInvokeExpression(
        settings,
        nodeIdMapCollection,
        invokeExpressionXorNode.node.id,
        typeCache,
    );
    if (ResultUtils.isError(triedInvokeExpression)) {
        throw triedInvokeExpression;
    }

    const invokeExpression: InvokeExpression = triedInvokeExpression.value;
    const maybeArguments: InvokeExpressionArguments | undefined = invokeExpression.maybeArguments;

    let maybeWithArgumentOrdinal: CurrentInvokeExpressionArguments | undefined;
    if (maybeArguments !== undefined) {
        maybeWithArgumentOrdinal = {
            ...maybeArguments,
            argumentOrdinal: getArgumentOrdinal(
                nodeIdMapCollection,
                activeNode,
                ancestryIndex,
                invokeExpressionXorNode,
            ),
        };
    }

    return {
        ...invokeExpression,
        maybeArguments: maybeWithArgumentOrdinal,
    };
}

function getArgumentOrdinal(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    ancestryIndex: number,
    invokeExpressionXorNode: TXorNode,
): number {
    // `foo(1|)
    const maybeAncestoryCsv: TXorNode | undefined = AncestryUtils.maybeNthPreviousXorChecked(
        activeNode.ancestry,
        ancestryIndex,
        2,
        Ast.NodeKind.Csv,
    );
    if (maybeAncestoryCsv !== undefined) {
        return maybeAncestoryCsv.node.maybeAttributeIndex ?? 0;
    }

    const maybePreviousXor: TXorNode | undefined = AncestryUtils.maybePreviousXorChecked(
        activeNode.ancestry,
        ancestryIndex,
        [
            // `foo(|)`
            Ast.NodeKind.ArrayWrapper,
            // `foo(1|`
            Ast.NodeKind.Constant,
        ],
    );

    let arrayWrapperXorNode: TXorNode;
    switch (maybePreviousXor?.node.kind) {
        case Ast.NodeKind.Constant: {
            arrayWrapperXorNode = NodeIdMapUtils.assertGetNthChildChecked(
                nodeIdMapCollection,
                invokeExpressionXorNode.node.id,
                1,
                Ast.NodeKind.ArrayWrapper,
            );

            break;
        }

        case Ast.NodeKind.ArrayWrapper: {
            arrayWrapperXorNode = maybePreviousXor;
            break;
        }

        case undefined:
        default:
            throw new PQP.CommonError.InvariantError(`encountered an unknown scenario for getArgumentOrdinal`, {
                ancestryIndex,
                ancestryNodeKinds: activeNode.ancestry.map((xorNode: TXorNode) => xorNode.node.kind),
            });
    }

    const maybeArrayWrapperChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(
        arrayWrapperXorNode.node.id,
    );

    return maybeArrayWrapperChildIds !== undefined ? maybeArrayWrapperChildIds.length - 1 : 0;
}

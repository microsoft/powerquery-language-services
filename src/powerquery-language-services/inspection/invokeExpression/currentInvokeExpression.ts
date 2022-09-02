// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { IInvokeExpression, InvokeExpressionArguments } from "./common";
import { InvokeExpression, TriedInvokeExpression, tryInvokeExpression } from "./invokeExpression";
import { TypeCache, TypeCacheUtils } from "../typeCache";
import { InspectionSettings } from "../../inspectionSettings";
import { InspectionTraceConstant } from "../..";

// An inspection of the inner most invoke expression for an ActiveNode.
export type TriedCurrentInvokeExpression = PQP.Result<CurrentInvokeExpression | undefined, PQP.CommonError.CommonError>;

// Identical to InvokeExpression except maybeArguments has an extra field, `argumentOrdinal`.
export type CurrentInvokeExpression = IInvokeExpression<CurrentInvokeExpressionArguments>;

export interface CurrentInvokeExpressionArguments extends InvokeExpressionArguments {
    readonly argumentOrdinal: number;
}

// If the cursor is in an InvokeExpression then return:
//  * the number of given arguments
//  * the number of expected arguments
//  * the given argument nodes
//  * the given argument types
//  * type checking for parameter types vs given types
export async function tryCurrentInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeActiveNode: TMaybeActiveNode,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Promise<TriedCurrentInvokeExpression> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectCurrentInvokeExpression,
        tryCurrentInvokeExpression.name,
        settings.initialCorrelationId,
    );

    const updatedSettings: InspectionSettings = {
        ...settings,
        initialCorrelationId: trace.id,
    };

    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        trace.exit();

        return Promise.resolve(ResultUtils.boxOk(undefined));
    }

    const result: TriedCurrentInvokeExpression = await ResultUtils.ensureResultAsync(
        () => inspectInvokeExpression(updatedSettings, nodeIdMapCollection, maybeActiveNode, typeCache, trace.id),
        updatedSettings.locale,
    );

    trace.exit();

    return result;
}

async function inspectInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    typeCache: TypeCache,
    maybeCorrelationId: number | undefined,
): Promise<CurrentInvokeExpression | undefined> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectCurrentInvokeExpression,
        inspectInvokeExpression.name,
        maybeCorrelationId,
    );

    const updatedSettings: InspectionSettings = {
        ...settings,
        initialCorrelationId: trace.id,
    };

    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;

    const maybeInvokeExpression: [TXorNode, number] | undefined = AncestryUtils.findXorAndIndexOfNodeKind(
        ancestry,
        Ast.NodeKind.InvokeExpression,
    );

    if (!maybeInvokeExpression) {
        trace.exit();

        return undefined;
    }

    const [invokeExpressionXorNode, ancestryIndex]: [TXorNode, number] = maybeInvokeExpression;

    const triedInvokeExpression: TriedInvokeExpression = await tryInvokeExpression(
        updatedSettings,
        nodeIdMapCollection,
        invokeExpressionXorNode.node.id,
        typeCache,
    );

    if (ResultUtils.isError(triedInvokeExpression)) {
        trace.exit({ [TraceConstant.IsThrowing]: true });

        throw triedInvokeExpression;
    }

    const invokeExpression: InvokeExpression = triedInvokeExpression.value;
    const maybeArguments: InvokeExpressionArguments | undefined = invokeExpression.arguments;

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

    const result: CurrentInvokeExpression | undefined = {
        ...invokeExpression,
        arguments: maybeWithArgumentOrdinal,
    };

    trace.exit();

    return result;
}

function getArgumentOrdinal(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    ancestryIndex: number,
    invokeExpressionXorNode: TXorNode,
): number {
    // `foo(1|)
    const maybeAncestoryCsv: TXorNode | undefined = AncestryUtils.nthPreviousXorChecked<Ast.TCsv>(
        activeNode.ancestry,
        ancestryIndex,
        2,
        Ast.NodeKind.Csv,
    );

    if (maybeAncestoryCsv !== undefined) {
        return maybeAncestoryCsv.node.attributeIndex ?? 0;
    }

    const maybePreviousXor: TXorNode | undefined = AncestryUtils.previousXorChecked<Ast.TArrayWrapper | Ast.TConstant>(
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
            arrayWrapperXorNode = NodeIdMapUtils.assertGetNthChildChecked<Ast.TArrayWrapper>(
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

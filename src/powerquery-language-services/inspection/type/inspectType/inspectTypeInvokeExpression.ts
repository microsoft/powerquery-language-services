// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ExternalType, ExternalTypeUtils } from "../../externalType";
import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, inspectXor } from "./common";
import { maybeDereferencedIdentifier } from "../../deferenceIdentifier";

export async function inspectTypeInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeInvokeExpression.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression);

    const maybeRequest: ExternalType.ExternalInvocationTypeRequest | undefined = await maybeExternalInvokeRequest(
        state,
        xorNode,
        trace.id,
    );

    if (maybeRequest !== undefined) {
        const maybeType: Type.TPowerQueryType | undefined = state.library.externalTypeResolver(maybeRequest);

        if (maybeType !== undefined) {
            trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(maybeType) });

            return maybeType;
        }
    }

    const previousSibling: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    const previousSiblingType: Type.TPowerQueryType = await inspectXor(state, previousSibling, trace.id);

    let result: Type.TPowerQueryType;

    if (previousSiblingType.kind === Type.TypeKind.Any) {
        result = Type.AnyInstance;
    } else if (previousSiblingType.kind !== Type.TypeKind.Function) {
        result = Type.NoneInstance;
    } else if (previousSiblingType.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction) {
        result = previousSiblingType.returnType;
    } else {
        result = Type.AnyInstance;
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

async function maybeExternalInvokeRequest(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<ExternalType.ExternalInvocationTypeRequest | undefined> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        maybeExternalInvokeRequest.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    const maybeIdentifier: XorNode<Ast.IdentifierExpression> | undefined =
        NodeIdMapUtils.maybeInvokeExpressionIdentifier(state.nodeIdMapCollection, xorNode.node.id);

    if (maybeIdentifier === undefined) {
        trace.exit();

        return undefined;
    }

    const updatedSettings: PQP.CommonSettings = {
        ...state,
        maybeInitialCorrelationId: trace.id,
    };

    const triedDeferencedIdentifier: PQP.Result<TXorNode | undefined, PQP.CommonError.CommonError> =
        await maybeDereferencedIdentifier(updatedSettings, state.nodeIdMapCollection, maybeIdentifier, state.scopeById);

    if (ResultUtils.isError(triedDeferencedIdentifier) || triedDeferencedIdentifier.value === undefined) {
        return undefined;
    }

    const types: Type.TPowerQueryType[] = [];

    for (const argument of NodeIdMapIterator.iterInvokeExpression(
        state.nodeIdMapCollection,
        XorNodeUtils.assertAsInvokeExpression(xorNode),
    )) {
        // eslint-disable-next-line no-await-in-loop
        types.push(await inspectXor(state, argument, trace.id));
    }

    const result: ExternalType.ExternalInvocationTypeRequest = ExternalTypeUtils.createInvocationTypeRequest(
        Assert.asDefined(XorNodeUtils.maybeIdentifierExpressionLiteral(triedDeferencedIdentifier.value)),
        types,
    );

    trace.exit();

    return result;
}

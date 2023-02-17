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

import { ExternalType, ExternalTypeUtils } from "../../../externalType";
import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, inspectXor } from "./common";
import { tryDeferenceIdentifier } from "../../deferenceIdentifier";

export async function inspectTypeInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeInvokeExpression.name,
        correlationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression);

    const request: ExternalType.ExternalInvocationTypeRequest | undefined = await externalInvokeRequest(
        state,
        xorNode,
        trace.id,
    );

    if (request !== undefined) {
        const type: Type.TPowerQueryType | undefined = state.library.externalTypeResolver(request);

        if (type !== undefined) {
            trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(type) });

            return type;
        }
    }

    const previousSibling: TXorNode = NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    const previousSiblingType: Type.TPowerQueryType = await inspectXor(state, previousSibling, trace.id);

    let result: Type.TPowerQueryType;

    if (previousSiblingType.kind === Type.TypeKind.Any) {
        result = Type.AnyInstance;
    } else if (previousSiblingType.kind !== Type.TypeKind.Function) {
        result = Type.NoneInstance;
    } else if (previousSiblingType.extendedKind === Type.ExtendedTypeKind.DefinedFunction) {
        result = previousSiblingType.returnType;
    } else {
        result = Type.AnyInstance;
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

async function externalInvokeRequest(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<ExternalType.ExternalInvocationTypeRequest | undefined> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        externalInvokeRequest.name,
        correlationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    const identifier: XorNode<Ast.IdentifierExpression> | undefined = NodeIdMapUtils.invokeExpressionIdentifier(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    if (identifier === undefined) {
        trace.exit();

        return undefined;
    }

    const updatedSettings: PQP.CommonSettings = {
        ...state,
        initialCorrelationId: trace.id,
    };

    const triedDeferencedIdentifier: PQP.Result<TXorNode | undefined, PQP.CommonError.CommonError> =
        await tryDeferenceIdentifier(updatedSettings, state.nodeIdMapCollection, identifier, state.scopeById);

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
        Assert.asDefined(XorNodeUtils.identifierExpressionLiteral(triedDeferencedIdentifier.value)),
        types,
    );

    trace.exit();

    return result;
}

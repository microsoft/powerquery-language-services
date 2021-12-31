// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// import * as PQP from "@microsoft/powerquery-parser";

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

import { ExternalType, ExternalTypeUtils } from "../../externalType";
import { InspectTypeState, inspectXor, recursiveIdentifierDereference } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export function inspectTypeInvokeExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeInvokeExpression.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );
    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression);

    const maybeRequest: ExternalType.ExternalInvocationTypeRequest | undefined = maybeExternalInvokeRequest(
        state,
        xorNode,
    );
    if (maybeRequest !== undefined && state.maybeExternalTypeResolver) {
        const maybeType: Type.TPowerQueryType | undefined = state.maybeExternalTypeResolver(maybeRequest);
        if (maybeType !== undefined) {
            trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(maybeType) });

            return maybeType;
        }
    }

    const previousSibling: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TPowerQueryType = inspectXor(state, previousSibling);

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

function maybeExternalInvokeRequest(
    state: InspectTypeState,
    xorNode: TXorNode,
): ExternalType.ExternalInvocationTypeRequest | undefined {
    const maybeIdentifier: TXorNode | undefined = NodeIdMapUtils.maybeInvokeExpressionIdentifier(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    if (maybeIdentifier === undefined) {
        return undefined;
    }
    const deferencedIdentifier: TXorNode = recursiveIdentifierDereference(state, maybeIdentifier);

    const types: Type.TPowerQueryType[] = [];
    for (const argument of NodeIdMapIterator.iterInvokeExpression(
        state.nodeIdMapCollection,
        XorNodeUtils.assertAsInvokeExpression(xorNode),
    )) {
        types.push(inspectXor(state, argument));
    }

    return ExternalTypeUtils.createInvocationTypeRequest(
        Assert.asDefined(XorNodeUtils.maybeIdentifierExpressionLiteral(deferencedIdentifier)),
        types,
    );
}

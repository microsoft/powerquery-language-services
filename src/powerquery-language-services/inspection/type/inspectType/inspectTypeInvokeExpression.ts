// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { ExternalType, ExternalTypeUtils } from "../../externalType";
import { InspectTypeState, inspectXor, recursiveIdentifierDereference } from "./common";

export function inspectTypeInvokeExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind(xorNode, Ast.NodeKind.InvokeExpression);

    const maybeRequest: ExternalType.ExternalInvocationTypeRequest | undefined = maybeExternalInvokeRequest(
        state,
        xorNode,
    );
    if (maybeRequest !== undefined && state.settings.maybeExternalTypeResolver) {
        const maybeType: Type.TPowerQueryType | undefined = state.settings.maybeExternalTypeResolver(maybeRequest);
        if (maybeType !== undefined) {
            return maybeType;
        }
    }

    const previousSibling: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TPowerQueryType = inspectXor(state, previousSibling);
    if (previousSiblingType.kind === Type.TypeKind.Any) {
        return Type.AnyInstance;
    } else if (previousSiblingType.kind !== Type.TypeKind.Function) {
        return Type.NoneInstance;
    } else if (previousSiblingType.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction) {
        return previousSiblingType.returnType;
    } else {
        return Type.AnyInstance;
    }
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

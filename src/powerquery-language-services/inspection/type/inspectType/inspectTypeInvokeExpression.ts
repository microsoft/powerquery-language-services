// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { ExternalType, ExternalTypeUtils } from "../../externalType";
import { InspectTypeState, inspectXor, recursiveIdentifierDereference } from "./common";

export function inspectTypeInvokeExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.PowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.InvokeExpression);

    const maybeRequest: ExternalType.ExternalInvocationTypeRequest | undefined = maybeExternalInvokeRequest(
        state,
        xorNode,
    );
    if (maybeRequest !== undefined && state.settings.maybeExternalTypeResolver) {
        const maybeType: PQP.Language.Type.PowerQueryType | undefined = state.settings.maybeExternalTypeResolver(
            maybeRequest,
        );
        if (maybeType !== undefined) {
            return maybeType;
        }
    }

    const previousSibling: PQP.Parser.TXorNode = PQP.Parser.NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: PQP.Language.Type.PowerQueryType = inspectXor(state, previousSibling);
    if (previousSiblingType.kind === PQP.Language.Type.TypeKind.Any) {
        return PQP.Language.Type.AnyInstance;
    } else if (previousSiblingType.kind !== PQP.Language.Type.TypeKind.Function) {
        return PQP.Language.Type.NoneInstance;
    } else if (previousSiblingType.maybeExtendedKind === PQP.Language.Type.ExtendedTypeKind.DefinedFunction) {
        return previousSiblingType.returnType;
    } else {
        return PQP.Language.Type.AnyInstance;
    }
}

function maybeExternalInvokeRequest(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): ExternalType.ExternalInvocationTypeRequest | undefined {
    const maybeIdentifier: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeInvokeExpressionIdentifier(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    if (maybeIdentifier === undefined) {
        return undefined;
    }
    const deferencedIdentifier: PQP.Parser.TXorNode = recursiveIdentifierDereference(state, maybeIdentifier);

    const types: PQP.Language.Type.PowerQueryType[] = [];
    for (const argument of PQP.Parser.NodeIdMapIterator.iterInvokeExpression(state.nodeIdMapCollection, xorNode)) {
        types.push(inspectXor(state, argument));
    }

    return ExternalTypeUtils.invocationTypeRequestFactory(
        Assert.asDefined(PQP.Parser.XorNodeUtils.maybeIdentifierExpressionLiteral(deferencedIdentifier)),
        types,
    );
}

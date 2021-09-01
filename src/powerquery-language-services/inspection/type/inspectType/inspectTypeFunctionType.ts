// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeFunctionType(state: InspectTypeState, xorNode: TXorNode): Type.FunctionType | Type.Unknown {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind(xorNode, Ast.NodeKind.FunctionType);

    const maybeParameters: XorNode<Ast.TParameterList> | undefined = NodeIdMapUtils.maybeNthChildChecked<
        Ast.TParameterList
    >(state.nodeIdMapCollection, xorNode.node.id, 1, Ast.NodeKind.ParameterList);
    if (maybeParameters === undefined) {
        return Type.UnknownInstance;
    }

    const maybeArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.maybeUnboxArrayWrapper(
        state.nodeIdMapCollection,
        maybeParameters.node.id,
    );
    if (maybeArrayWrapper === undefined) {
        return Type.UnknownInstance;
    }

    const parameterTypes: ReadonlyArray<Type.FunctionParameter> = NodeIdMapIterator.iterArrayWrapper(
        state.nodeIdMapCollection,
        maybeArrayWrapper,
    )
        .map((parameter: TXorNode) =>
            TypeUtils.inspectParameter(state.nodeIdMapCollection, XorNodeUtils.assertAsParameter(parameter)),
        )
        .filter(PQP.TypeScriptUtils.isDefined);

    const returnType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 2);

    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.FunctionType,
        isNullable: false,
        parameters: parameterTypes,
        returnType,
    };
}

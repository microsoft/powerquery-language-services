// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeFunctionType(state: InspectTypeState, xorNode: TXorNode): Type.FunctionType | Type.Unknown {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeFunctionType.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );
    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FunctionType>(xorNode, Ast.NodeKind.FunctionType);

    const maybeParameters: XorNode<Ast.TParameterList> | undefined =
        NodeIdMapUtils.maybeNthChildChecked<Ast.TParameterList>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            1,
            Ast.NodeKind.ParameterList,
        );
    if (maybeParameters === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const maybeArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.maybeUnboxArrayWrapper(
        state.nodeIdMapCollection,
        maybeParameters.node.id,
    );
    if (maybeArrayWrapper === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(Type.UnknownInstance) });

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
    const result: Type.TPowerQueryType = {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.FunctionType,
        isNullable: false,
        parameters: parameterTypes,
        returnType,
    };
    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { InspectionTraceConstant, TraceUtils } from "../../..";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

import { inspectParameterAnnotation, inspectTypeFromChildAttributeIndex } from "./common";
import { InspectTypeState } from "./inspectTypeState";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeFunctionType(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.FunctionType | Type.Type | Type.Unknown> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeFunctionType.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FunctionType>(xorNode, Ast.NodeKind.FunctionType);

    let result: Type.FunctionType | Type.Type | Type.Unknown;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const parameters: XorNode<Ast.TParameterList> | undefined =
                NodeIdMapUtils.nthChildXorChecked<Ast.TParameterList>(
                    state.nodeIdMapCollection,
                    xorNode.node.id,
                    1,
                    Ast.NodeKind.ParameterList,
                );

            if (parameters === undefined) {
                trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.UnknownInstance) });

                return Type.UnknownInstance;
            }

            const arrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.arrayWrapperContentXor(
                state.nodeIdMapCollection,
                parameters.node.id,
            );

            if (arrayWrapper === undefined) {
                trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.UnknownInstance) });

                return Type.UnknownInstance;
            }

            const parameterTypes: Type.FunctionParameter[] = [];

            for (const parameter of NodeIdMapIterator.iterArrayWrapper(state.nodeIdMapCollection, arrayWrapper)) {
                const inspectedParameter: TypeUtils.InspectedParameter = TypeUtils.inspectParameter(
                    state.nodeIdMapCollection,
                    XorNodeUtils.assertAsNodeKind<Ast.TParameter>(parameter, Ast.NodeKind.Parameter),
                );

                switch (inspectedParameter.kind) {
                    case TypeUtils.InspectedParameterKind.Resolved:
                        parameterTypes.push({
                            nameLiteral: inspectedParameter.nameLiteral,
                            isNullable: inspectedParameter.isNullable,
                            isOptional: inspectedParameter.isOptional,
                            type: inspectedParameter.type,
                        });

                        break;

                    case TypeUtils.InspectedParameterKind.RequiresResolution: {
                        // Inspect sequentially: aliases share recursion-tracking state.
                        // eslint-disable-next-line no-await-in-loop
                        const annotationType: Type.TPrimitiveType = await inspectParameterAnnotation(
                            state,
                            inspectedParameter.annotation,
                            trace.id,
                        );

                        parameterTypes.push({
                            nameLiteral: inspectedParameter.nameLiteral,
                            isNullable: annotationType.isNullable,
                            isOptional: inspectedParameter.isOptional,
                            type: annotationType.kind,
                        });

                        break;
                    }

                    case TypeUtils.InspectedParameterKind.MissingName:
                    case TypeUtils.InspectedParameterKind.NotType:
                        break;

                    default:
                        throw Assert.isNever(inspectedParameter);
                }
            }

            const returnType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(
                state,
                xorNode,
                2,
                trace.id,
            );

            result = {
                kind: Type.TypeKind.Type,
                extendedKind: Type.ExtendedTypeKind.FunctionType,
                isNullable: false,
                parameters: parameterTypes,
                returnType,
            };

            break;
        }

        case TypeStrategy.Primitive:
            result = Type.TypePrimitiveInstance;
            break;

        default:
            Assert.isNever(state.typeStrategy);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

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

import { inspectTypeFromChildAttributeIndex } from "./common";
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
                // Parameters share cycle-detection state, so inspect them sequentially.
                // eslint-disable-next-line no-await-in-loop
                const parameterType: Type.FunctionParameter | undefined = await inspectFunctionTypeParameter(
                    state,
                    parameter,
                    trace.id,
                );

                if (parameterType !== undefined) {
                    parameterTypes.push(parameterType);
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

async function inspectFunctionTypeParameter(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number,
): Promise<Type.FunctionParameter | undefined> {
    const parameter: XorNode<Ast.TParameter> = XorNodeUtils.assertAsNodeKind<Ast.TParameter>(
        xorNode,
        Ast.NodeKind.Parameter,
    );

    if (
        XorNodeUtils.isContext(parameter) ||
        parameter.node.parameterType === undefined ||
        parameter.node.parameterType.kind === Ast.NodeKind.AsNullablePrimitiveType
    ) {
        return TypeUtils.inspectParameter(state.nodeIdMapCollection, parameter);
    }

    const parameterType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(
        state,
        parameter,
        2,
        correlationId,
    );

    let type: Type.TypeKind = parameterType.kind;
    let isNullable: boolean = parameterType.isNullable;

    // Structured type expressions describe values, not parameters of kind Type.
    switch (parameterType.extendedKind) {
        case Type.ExtendedTypeKind.FunctionType:
            type = Type.TypeKind.Function;
            break;

        case Type.ExtendedTypeKind.DefinedListType:
        case Type.ExtendedTypeKind.ListType:
            type = Type.TypeKind.List;
            break;

        case Type.ExtendedTypeKind.RecordType:
            type = Type.TypeKind.Record;
            break;

        case Type.ExtendedTypeKind.TableType:
        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            type = Type.TypeKind.Table;
            break;

        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            type = parameterType.primitiveType.kind;
            isNullable = isNullable || parameterType.primitiveType.isNullable;
            break;

        case undefined:
        case Type.ExtendedTypeKind.AnyUnion:
        case Type.ExtendedTypeKind.DefinedFunction:
        case Type.ExtendedTypeKind.DefinedList:
        case Type.ExtendedTypeKind.DefinedRecord:
        case Type.ExtendedTypeKind.DefinedTable:
        case Type.ExtendedTypeKind.LogicalLiteral:
        case Type.ExtendedTypeKind.NumberLiteral:
        case Type.ExtendedTypeKind.TextLiteral:
            break;
    }

    return {
        nameLiteral: parameter.node.name.literal,
        isOptional: parameter.node.optionalConstant !== undefined,
        isNullable,
        type,
    };
}

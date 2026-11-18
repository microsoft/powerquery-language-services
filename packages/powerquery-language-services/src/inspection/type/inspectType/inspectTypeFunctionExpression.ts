// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectParameterAnnotation, inspectTypeFromChildAttributeIndex } from "./common";
import { PseduoFunctionExpressionType, pseudoFunctionExpressionType } from "../../pseudoFunctionExpressionType";
import { InspectTypeState } from "./inspectTypeState";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeFunctionExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeFunctionExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FunctionExpression>(xorNode, Ast.NodeKind.FunctionExpression);

    const pseudoType: PseduoFunctionExpressionType = pseudoFunctionExpressionType(state.nodeIdMapCollection, xorNode);
    const pseudoReturnType: Type.TPrimitiveType = pseudoType.returnType;

    let result: Type.TPowerQueryType;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const expressionType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(
                state,
                xorNode,
                3,
                trace.id,
            );

            const returnType: Type.TPowerQueryType = inspectReturnType(
                state,
                expressionType,
                pseudoReturnType,
                trace.id,
            );

            if (returnType.kind === Type.TypeKind.None && pseudoReturnType.kind !== Type.TypeKind.Any) {
                trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.NoneInstance) });

                return Type.NoneInstance;
            }

            const parameters: Type.FunctionParameter[] = [];

            for (const pseudoParameter of pseudoType.parameters) {
                const annotationType: Type.TPrimitiveType | undefined =
                    pseudoParameter.annotation === undefined
                        ? undefined
                        : // eslint-disable-next-line no-await-in-loop
                          await inspectParameterAnnotation(state, pseudoParameter.annotation, trace.id);

                parameters.push({
                    nameLiteral: pseudoParameter.name.literal,
                    isNullable: annotationType?.isNullable ?? pseudoParameter.isNullable,
                    isOptional: pseudoParameter.isOptional,
                    type: annotationType?.kind ?? pseudoParameter.type,
                });
            }

            result = {
                kind: Type.TypeKind.Function,
                extendedKind: Type.ExtendedTypeKind.DefinedFunction,
                isNullable: false,
                parameters,
                returnType,
            };

            break;
        }

        case TypeStrategy.Primitive:
            result = pseudoReturnType;
            break;

        default:
            Assert.isNever(state.typeStrategy);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function inspectReturnType(
    state: InspectTypeState,
    expressionType: Type.TPowerQueryType,
    annotationType: Type.TPrimitiveType,
    correlationId: number,
): Type.TPowerQueryType {
    if (annotationType.kind === Type.TypeKind.Any) {
        return expressionType;
    } else if (expressionType.extendedKind === Type.ExtendedTypeKind.AnyUnion) {
        const returnTypes: ReadonlyArray<Type.TPowerQueryType> = expressionType.unionedTypePairs.map(
            (type: Type.TPowerQueryType) => inspectReturnType(state, type, annotationType, correlationId),
        );

        // Do not discard invalid alternatives, including errors, when applying the annotation.
        if (returnTypes.some((type: Type.TPowerQueryType) => type.kind === Type.TypeKind.None)) {
            return Type.NoneInstance;
        }

        const returnType: Type.TPowerQueryType = TypeUtils.anyUnion(returnTypes, state.traceManager, correlationId);

        return {
            ...returnType,
            isNullable: returnType.isNullable || (expressionType.isNullable && annotationType.isNullable),
        };
    } else if (expressionType.kind === Type.TypeKind.Any || expressionType.kind === Type.TypeKind.Unknown) {
        return annotationType;
    } else if (expressionType.kind === annotationType.kind) {
        // The annotation constrains successful runtime results without losing extended type information.
        return expressionType.isNullable && !annotationType.isNullable && expressionType.kind !== Type.TypeKind.Null
            ? { ...expressionType, isNullable: false }
            : expressionType;
    } else {
        return TypeUtils.isCompatible(expressionType, annotationType, state.traceManager, correlationId) === true
            ? expressionType
            : Type.NoneInstance;
    }
}

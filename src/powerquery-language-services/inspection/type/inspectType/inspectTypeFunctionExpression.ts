// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert } from "@microsoft/powerquery-parser";

import { allForAnyUnion, inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";
import { InspectionTraceConstant, TraceUtils } from "../../..";
import {
    PseduoFunctionExpressionType,
    pseudoFunctionExpressionType,
    PseudoFunctionParameterType,
} from "../../pseudoFunctionExpressionType";
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
    const pseudoReturnType: Type.TPowerQueryType = pseudoType.returnType;

    let result: Type.TPowerQueryType;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const expressionType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(
                state,
                xorNode,
                3,
                trace.id,
            );

            // FunctionExpression.functionReturnType doesn't always match FunctionExpression.expression.
            // By examining the expression we might get a more accurate return type (eg. Function vs DefinedFunction),
            // or discover an error (eg. functionReturnType is Number but expression is Text).

            let returnType: Type.TPowerQueryType;

            // If the stated return type is Any,
            // then it might as well be the expression's type as it can't be any wider than Any.
            if (pseudoReturnType.kind === Type.TypeKind.Any) {
                returnType = expressionType;
            }
            // If the return type is Any then see if we can narrow it to the stated return Type.
            else if (
                expressionType.kind === Type.TypeKind.Any &&
                expressionType.extendedKind === Type.ExtendedTypeKind.AnyUnion &&
                allForAnyUnion(
                    expressionType,
                    (type: Type.TPowerQueryType) =>
                        type.kind === pseudoReturnType.kind || type.kind === Type.TypeKind.Any,
                )
            ) {
                returnType = expressionType;
            }
            // If the stated return type doesn't match the expression's type then it's None.
            else if (pseudoReturnType.kind !== expressionType.kind) {
                trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.NoneInstance) });

                return Type.NoneInstance;
            }
            // If the expression's type can't be known, then assume it's the stated return Type.
            else if (expressionType.kind === Type.TypeKind.Unknown) {
                returnType = pseudoReturnType;
            }
            // Else fallback to the expression's Type.
            else {
                returnType = expressionType;
            }

            result = {
                kind: Type.TypeKind.Function,
                extendedKind: Type.ExtendedTypeKind.DefinedFunction,
                isNullable: false,
                parameters: pseudoType.parameters.map((pseudoParameter: PseudoFunctionParameterType) => ({
                    nameLiteral: pseudoParameter.name.literal,
                    isNullable: pseudoParameter.isNullable,
                    isOptional: pseudoParameter.isOptional,
                    type: pseudoParameter.type,
                })),
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

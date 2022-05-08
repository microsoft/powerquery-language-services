// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { allForAnyUnion, inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";
import { InspectionTraceConstant, TraceUtils } from "../../..";
import {
    PseduoFunctionExpressionType,
    pseudoFunctionExpressionType,
    PseudoFunctionParameterType,
} from "../../pseudoFunctionExpressionType";

export async function inspectTypeFunctionExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeFunctionExpression.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FunctionExpression>(xorNode, Ast.NodeKind.FunctionExpression);

    const pseudoType: PseduoFunctionExpressionType = pseudoFunctionExpressionType(state.nodeIdMapCollection, xorNode);
    const pseudoReturnType: Type.TPowerQueryType = pseudoType.returnType;
    const expressionType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 3, trace.id);

    // FunctionExpression.maybeFunctionReturnType doesn't always match FunctionExpression.expression.
    // By examining the expression we might get a more accurate return type (eg. Function vs DefinedFunction),
    // or discover an error (eg. maybeFunctionReturnType is Number but expression is Text).

    let returnType: Type.TPowerQueryType;

    // If the stated return type is Any,
    // then it might as well be the expression's type as it can't be any wider than Any.
    if (pseudoReturnType.kind === Type.TypeKind.Any) {
        returnType = expressionType;
    }
    // If the return type is Any then see if we can narrow it to the stated return Type.
    else if (
        expressionType.kind === Type.TypeKind.Any &&
        expressionType.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion &&
        allForAnyUnion(
            expressionType,
            (type: Type.TPowerQueryType) => type.kind === pseudoReturnType.kind || type.kind === Type.TypeKind.Any,
        )
    ) {
        returnType = expressionType;
    }
    // If the stated return type doesn't match the expression's type then it's None.
    else if (pseudoReturnType.kind !== expressionType.kind) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(Type.NoneInstance) });

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

    const result: Type.TPowerQueryType = {
        kind: Type.TypeKind.Function,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
        isNullable: false,
        parameters: pseudoType.parameters.map((pseudoParameter: PseudoFunctionParameterType) => ({
            nameLiteral: pseudoParameter.name.literal,
            isNullable: pseudoParameter.isNullable,
            isOptional: pseudoParameter.isOptional,
            maybeType: pseudoParameter.maybeType,
        })),
        returnType,
    };

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

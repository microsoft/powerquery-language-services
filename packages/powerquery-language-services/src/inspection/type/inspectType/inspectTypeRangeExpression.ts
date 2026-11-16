// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectTypeFromChildAttributeIndex } from "./common";
import { InspectTypeState } from "./inspectTypeState";
import { TypeStrategy } from "../../../inspectionSettings";

const MaxDefinedRangeElements: number = 100;

export async function inspectTypeRangeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeRangeExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.RangeExpression>(xorNode, Ast.NodeKind.RangeExpression);

    let result: Type.TList | Type.None | Type.Unknown;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const leftType: Type.TPowerQueryType | undefined = await inspectTypeFromChildAttributeIndex(
                state,
                xorNode,
                0,
                trace.id,
            );

            const rightType: Type.TPowerQueryType | undefined = await inspectTypeFromChildAttributeIndex(
                state,
                xorNode,
                2,
                trace.id,
            );

            if (leftType === undefined || rightType === undefined) {
                result = Type.UnknownInstance;
            } else if (leftType.kind === Type.TypeKind.Number && rightType.kind === Type.TypeKind.Number) {
                result = inspectNumericRange(leftType, rightType);
            } else if (leftType.kind === Type.TypeKind.None || rightType.kind === Type.TypeKind.None) {
                result = Type.NoneInstance;
            } else if (leftType.kind === Type.TypeKind.Unknown || rightType.kind === Type.TypeKind.Unknown) {
                result = Type.UnknownInstance;
            } else {
                result = Type.NoneInstance;
            }

            break;
        }

        case TypeStrategy.Primitive:
            result = Type.ListInstance;
            break;

        default:
            Assert.isNever(state.typeStrategy);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function inspectNumericRange(leftType: Type.TNumber, rightType: Type.TNumber): Type.TList {
    if (
        leftType.extendedKind !== Type.ExtendedTypeKind.NumberLiteral ||
        rightType.extendedKind !== Type.ExtendedTypeKind.NumberLiteral ||
        leftType.isNullable ||
        rightType.isNullable
    ) {
        return Type.ListInstance;
    }

    const start: number = leftType.normalizedLiteral;
    const end: number = rightType.normalizedLiteral;

    // Only expand bounded integer ranges whose increments can be represented exactly.
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        return Type.ListInstance;
    }

    const length: number = Math.max(0, end - start + 1);

    if (!Number.isSafeInteger(length) || length > MaxDefinedRangeElements) {
        return Type.ListInstance;
    }

    return TypeUtils.definedList(
        false,
        Array.from({ length }, (_: unknown, index: number) => TypeUtils.numberLiteral(false, start + index)),
    );
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";
import { Assert } from "@microsoft/powerquery-parser";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeRangeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeRangeExpression.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.RangeExpression>(xorNode, Ast.NodeKind.RangeExpression);

    let result: Type.List | Type.None | Type.Unknown;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const maybeLeftType: Type.TPowerQueryType | undefined = await inspectTypeFromChildAttributeIndex(
                state,
                xorNode,
                0,
                trace.id,
            );

            const maybeRightType: Type.TPowerQueryType | undefined = await inspectTypeFromChildAttributeIndex(
                state,
                xorNode,
                2,
                trace.id,
            );

            if (maybeLeftType === undefined || maybeRightType === undefined) {
                result = Type.UnknownInstance;
            } else if (maybeLeftType.kind === Type.TypeKind.Number && maybeRightType.kind === Type.TypeKind.Number) {
                // TODO: handle isNullable better
                if (maybeLeftType.isNullable === true || maybeRightType.isNullable === true) {
                    result = Type.NoneInstance;
                } else {
                    result = Type.ListInstance;
                }
            } else if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
                result = Type.NoneInstance;
            } else if (maybeLeftType.kind === Type.TypeKind.Unknown || maybeRightType.kind === Type.TypeKind.Unknown) {
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

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

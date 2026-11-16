// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectTypeFromChildAttributeIndex } from "./common";
import { InspectTypeState } from "./inspectTypeState";

export async function inspectTypeNullCoalescingExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeNullCoalescingExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.NullCoalescingExpression>(xorNode, Ast.NodeKind.NullCoalescingExpression);

    const leftType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 0, trace.id);

    const nullCoalescingOperator: Ast.TConstant | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        Ast.NodeKind.Constant,
    );

    let result: Type.TPowerQueryType;

    // '??' isn't present, treat it as an Expression.
    if (nullCoalescingOperator === undefined) {
        result = leftType;
    } else if (leftType.kind === Type.TypeKind.None) {
        result = Type.NoneInstance;
    } else if (!leftType.isNullable) {
        result = leftType;
    } else {
        const rightType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 2, trace.id);

        if (rightType.kind === Type.TypeKind.None) {
            result = Type.NoneInstance;
        } else {
            const nonNullableLeft: ReadonlyArray<Type.TPowerQueryType> = nonNullableMembers(leftType);

            result = nonNullableLeft.length
                ? {
                      ...TypeUtils.anyUnion([...nonNullableLeft, rightType], state.traceManager, trace.id),
                      // Simplification can absorb a nullable RHS into a non-nullable left member.
                      isNullable: rightType.isNullable,
                  }
                : rightType;
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function nonNullableMembers(type: Type.TPowerQueryType): ReadonlyArray<Type.TPowerQueryType> {
    if (type.kind === Type.TypeKind.Null) {
        return [];
    } else if (TypeUtils.isAnyUnion(type)) {
        return type.unionedTypePairs.flatMap(nonNullableMembers);
    } else {
        return [{ ...type, isNullable: false }];
    }
}

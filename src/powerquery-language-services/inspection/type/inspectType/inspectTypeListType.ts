// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, inspectXor } from "./common";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeListType(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.Type | Type.ListType | Type.Unknown> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeListType.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.ListType>(xorNode, Ast.NodeKind.ListType);

    let result: Type.Type | Type.ListType | Type.Unknown;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const maybeListItem: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
                state.nodeIdMapCollection,
                xorNode.node.id,
                1,
            );

            if (maybeListItem === undefined) {
                result = Type.UnknownInstance;
            } else {
                const itemType: Type.TPowerQueryType = await inspectXor(state, maybeListItem, trace.id);

                result = {
                    kind: Type.TypeKind.Type,
                    maybeExtendedKind: Type.ExtendedTypeKind.ListType,
                    isNullable: false,
                    itemType,
                };
            }

            break;
        }

        case TypeStrategy.Primitive:
            result = Type.TypePrimitiveInstance;
            break;

        default:
            Assert.isNever(state.typeStrategy);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

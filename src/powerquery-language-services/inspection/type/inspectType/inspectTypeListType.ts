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
    correlationId: number | undefined,
): Promise<Type.Type | Type.ListType | Type.Unknown> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeListType.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.ListType>(xorNode, Ast.NodeKind.ListType);

    let result: Type.Type | Type.ListType | Type.Unknown;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const listItem: TXorNode | undefined = NodeIdMapUtils.nthChild(
                state.nodeIdMapCollection,
                xorNode.node.id,
                1,
            );

            if (listItem === undefined) {
                result = Type.UnknownInstance;
            } else {
                const itemType: Type.TPowerQueryType = await inspectXor(state, listItem, trace.id);

                result = {
                    kind: Type.TypeKind.Type,
                    extendedKind: Type.ExtendedTypeKind.ListType,
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

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

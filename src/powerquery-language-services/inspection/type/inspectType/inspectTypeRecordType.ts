// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";
import { InspectTypeState } from "./common";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeRecordType(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.Type | Type.RecordType | Type.Unknown> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeRecordType.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.RecordType>(xorNode, Ast.NodeKind.RecordType);

    let result: Type.Type | Type.RecordType | Type.Unknown;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const maybeFields: TXorNode | undefined = NodeIdMapUtils.maybeNthChildChecked<Ast.FieldSpecificationList>(
                state.nodeIdMapCollection,
                xorNode.node.id,
                0,
                Ast.NodeKind.FieldSpecificationList,
            );

            if (maybeFields === undefined) {
                result = Type.UnknownInstance;
            } else {
                result = {
                    kind: Type.TypeKind.Type,
                    maybeExtendedKind: Type.ExtendedTypeKind.RecordType,
                    isNullable: false,
                    ...(await examineFieldSpecificationList(state, maybeFields, trace.id)),
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

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
    correlationId: number | undefined,
): Promise<Type.Type | Type.RecordType | Type.Unknown> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeRecordType.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.RecordType>(xorNode, Ast.NodeKind.RecordType);

    let result: Type.Type | Type.RecordType | Type.Unknown;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const fields: TXorNode | undefined = NodeIdMapUtils.nthChildChecked<Ast.FieldSpecificationList>(
                state.nodeIdMapCollection,
                xorNode.node.id,
                0,
                Ast.NodeKind.FieldSpecificationList,
            );

            if (fields === undefined) {
                result = Type.UnknownInstance;
            } else {
                result = {
                    kind: Type.TypeKind.Type,
                    extendedKind: Type.ExtendedTypeKind.RecordType,
                    isNullable: false,
                    ...(await examineFieldSpecificationList(state, fields, trace.id)),
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

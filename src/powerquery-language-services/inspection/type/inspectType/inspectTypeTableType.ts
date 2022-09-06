// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, inspectXor } from "./common";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeTableType(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.Type | Type.TableType | Type.TableTypePrimaryExpression | Type.Unknown> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeTableType.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.TableType>(xorNode, Ast.NodeKind.TableType);

    let result: Type.Type | Type.TableType | Type.TableTypePrimaryExpression | Type.Unknown;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const maybeRowType: TXorNode | undefined = NodeIdMapUtils.nthChild(
                state.nodeIdMapCollection,
                xorNode.node.id,
                1,
            );

            if (maybeRowType === undefined) {
                result = Type.UnknownInstance;
            } else if (maybeRowType.node.kind === Ast.NodeKind.FieldSpecificationList) {
                result = {
                    kind: Type.TypeKind.Type,
                    extendedKind: Type.ExtendedTypeKind.TableType,
                    isNullable: false,
                    ...(await examineFieldSpecificationList(state, maybeRowType, trace.id)),
                };
            } else {
                result = {
                    kind: Type.TypeKind.Type,
                    extendedKind: Type.ExtendedTypeKind.TableTypePrimaryExpression,
                    isNullable: false,
                    primaryExpression: await inspectXor(state, maybeRowType, trace.id),
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

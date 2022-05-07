// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectTypeState, inspectXor } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";

export async function inspectTypeTableType(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TableType | Type.TableTypePrimaryExpression | Type.Unknown> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeTableType.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.TableType>(xorNode, Ast.NodeKind.TableType);

    const maybeRowType: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
    );

    let result: Type.TPowerQueryType;

    if (maybeRowType === undefined) {
        result = Type.UnknownInstance;
    } else if (maybeRowType.node.kind === Ast.NodeKind.FieldSpecificationList) {
        result = {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.TableType,
            isNullable: false,
            ...(await examineFieldSpecificationList(state, maybeRowType, trace.id)),
        };
    } else {
        result = {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.TableTypePrimaryExpression,
            isNullable: false,
            primaryExpression: await inspectXor(state, maybeRowType, trace.id),
        };
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

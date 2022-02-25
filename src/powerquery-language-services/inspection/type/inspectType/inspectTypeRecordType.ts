// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { LanguageServiceTraceConstant, TraceUtils } from "../../..";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";
import { InspectTypeState } from "./common";

export async function inspectTypeRecordType(
    state: InspectTypeState,
    xorNode: TXorNode,
): Promise<Type.RecordType | Type.Unknown> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeRecordType.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.RecordType>(xorNode, Ast.NodeKind.RecordType);

    const maybeFields: TXorNode | undefined = NodeIdMapUtils.maybeNthChildChecked<Ast.FieldSpecificationList>(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        Ast.NodeKind.FieldSpecificationList,
    );

    let result: Type.TPowerQueryType;

    if (maybeFields === undefined) {
        result = Type.UnknownInstance;
    } else {
        result = {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.RecordType,
            isNullable: false,
            ...(await examineFieldSpecificationList(state, maybeFields)),
        };
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

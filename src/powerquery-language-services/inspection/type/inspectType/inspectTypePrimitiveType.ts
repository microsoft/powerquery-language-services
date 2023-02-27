// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState } from ".";

export function inspectTypePrimitiveType(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Type.TPowerQueryType {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypePrimitiveType.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    XorNodeUtils.assertIsNodeKind<Ast.PrimitiveType>(xorNode, Ast.NodeKind.PrimitiveType);

    if (XorNodeUtils.isContextXor(xorNode)) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const kind: Type.TypeKind = TypeUtils.typeKindFromPrimitiveTypeConstantKind(xorNode.node.primitiveTypeKind);

    const result: Type.TPowerQueryType = {
        kind,
        extendedKind: undefined,
        isNullable: false,
    };

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

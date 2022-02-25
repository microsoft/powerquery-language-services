// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectTypeState, maybeDereferencedIdentifierType } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export async function inspectTypeIdentifier(state: InspectTypeState, xorNode: TXorNode): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeIdentifier.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.Identifier>(xorNode, Ast.NodeKind.Identifier);

    let result: Type.TPowerQueryType;

    if (XorNodeUtils.isContextXor(xorNode)) {
        result = Type.UnknownInstance;
    } else {
        const dereferencedType: Type.TPowerQueryType | undefined = await maybeDereferencedIdentifierType(
            state,
            xorNode,
        );

        result = dereferencedType ?? Type.UnknownInstance;
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

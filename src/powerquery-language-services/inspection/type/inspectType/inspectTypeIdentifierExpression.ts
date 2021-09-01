// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectTypeState, maybeDereferencedIdentifierType } from "./common";

export function inspectTypeIdentifierExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.IdentifierExpression>(xorNode, Ast.NodeKind.IdentifierExpression);

    if (XorNodeUtils.isContextXor(xorNode)) {
        return Type.UnknownInstance;
    }

    const dereferencedType: Type.TPowerQueryType | undefined = maybeDereferencedIdentifierType(state, xorNode);
    return dereferencedType ?? Type.UnknownInstance;
}

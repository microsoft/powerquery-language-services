// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState, maybeDereferencedIdentifierType } from "./common";

export function inspectTypeIdentifierExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertIsNodeKind(xorNode, PQP.Language.Ast.NodeKind.IdentifierExpression);

    if (xorNode.kind === PQP.Parser.XorNodeKind.Context) {
        return PQP.Language.Type.UnknownInstance;
    }

    const dereferencedType: PQP.Language.Type.TPowerQueryType | undefined = maybeDereferencedIdentifierType(
        state,
        xorNode,
    );
    return dereferencedType ?? PQP.Language.Type.UnknownInstance;
}

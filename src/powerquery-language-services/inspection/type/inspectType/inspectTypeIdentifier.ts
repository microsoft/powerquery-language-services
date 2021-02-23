// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState, maybeDereferencedIdentifierType } from "./common";

export function inspectTypeIdentifier(state: InspectTypeState, xorNode: PQP.Parser.TXorNode): PQP.Language.Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.Identifier);

    if (xorNode.kind === PQP.Parser.XorNodeKind.Context) {
        return PQP.Language.Type.UnknownInstance;
    }

    const dereferencedType: PQP.Language.Type.TType | undefined = maybeDereferencedIdentifierType(state, xorNode);
    return dereferencedType ?? PQP.Language.Type.UnknownInstance;
}

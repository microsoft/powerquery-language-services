// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeListType<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.ListType | PQP.Language.Type.Unknown {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.ListType);

    const maybeListItem: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeListItem === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }
    const itemType: PQP.Language.Type.PowerQueryType = inspectXor(state, maybeListItem);

    return {
        kind: PQP.Language.Type.TypeKind.Type,
        maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.ListType,
        isNullable: false,
        itemType,
    };
}

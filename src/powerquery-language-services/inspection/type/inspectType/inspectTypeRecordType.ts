// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState } from "./common";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";

export function inspectTypeRecordType(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.RecordType | PQP.Language.Type.Unknown {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.RecordType);

    const maybeFields:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        [PQP.Language.Ast.NodeKind.FieldSpecificationList],
    );
    if (maybeFields === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }

    return {
        kind: PQP.Language.Type.TypeKind.Type,
        maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.RecordType,
        isNullable: false,
        ...examineFieldSpecificationList(state, maybeFields),
    };
}

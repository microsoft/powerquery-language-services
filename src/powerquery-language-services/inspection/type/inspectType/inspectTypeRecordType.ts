// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectTypeState } from "./common";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";

export function inspectTypeRecordType(state: InspectTypeState, xorNode: TXorNode): Type.RecordType | Type.Unknown {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.RecordType>(xorNode, Ast.NodeKind.RecordType);

    const maybeFields: TXorNode | undefined = NodeIdMapUtils.maybeNthChildChecked(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        Ast.NodeKind.FieldSpecificationList,
    );
    if (maybeFields === undefined) {
        return Type.UnknownInstance;
    }

    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.RecordType,
        isNullable: false,
        ...examineFieldSpecificationList(state, maybeFields),
    };
}

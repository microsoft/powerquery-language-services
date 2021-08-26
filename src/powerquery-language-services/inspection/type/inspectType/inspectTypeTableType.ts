// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";

export function inspectTypeTableType(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TableType | PQP.Language.Type.TableTypePrimaryExpression | PQP.Language.Type.Unknown {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertIsNodeKind(xorNode, PQP.Language.Ast.NodeKind.TableType);

    const maybeRowType: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeNthChild(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
    );
    if (maybeRowType === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }

    if (maybeRowType.node.kind === PQP.Language.Ast.NodeKind.FieldSpecificationList) {
        return {
            kind: PQP.Language.Type.TypeKind.Type,
            maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.TableType,
            isNullable: false,
            ...examineFieldSpecificationList(state, maybeRowType),
        };
    } else {
        return {
            kind: PQP.Language.Type.TypeKind.Type,
            maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.TableTypePrimaryExpression,
            isNullable: false,
            primaryExpression: inspectXor(state, maybeRowType),
        };
    }
}

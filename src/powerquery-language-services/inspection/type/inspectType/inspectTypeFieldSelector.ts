// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { XorNodeUtils } from "../../../../../../powerquery-parser/lib/powerquery-parser/parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeFieldSelector(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind(xorNode, PQP.Language.Ast.NodeKind.FieldSelector);

    const maybeFieldName:
        | PQP.Language.Ast.GeneralizedIdentifier
        | undefined = PQP.Parser.NodeIdMapUtils.maybeUnwrapWrappedContentIfAstChecked(
        state.nodeIdMapCollection,
        xorNode.node.id,
        PQP.Language.Ast.NodeKind.GeneralizedIdentifier,
    );
    if (maybeFieldName === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }
    const fieldName: string = maybeFieldName.literal;

    const previousSibling: PQP.Parser.TXorNode = PQP.Parser.NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: PQP.Language.Type.TPowerQueryType = inspectXor(state, previousSibling);
    const isOptional: boolean =
        PQP.Parser.NodeIdMapUtils.maybeUnwrapNthChildIfAstChecked(
            state.nodeIdMapCollection,
            xorNode.node.id,
            3,
            PQP.Language.Ast.NodeKind.Constant,
        ) !== undefined;

    switch (previousSiblingType.kind) {
        case PQP.Language.Type.TypeKind.Any:
            return PQP.Language.Type.AnyInstance;

        case PQP.Language.Type.TypeKind.Unknown:
            return PQP.Language.Type.UnknownInstance;

        case PQP.Language.Type.TypeKind.Record:
        case PQP.Language.Type.TypeKind.Table:
            switch (previousSiblingType.maybeExtendedKind) {
                case undefined:
                    return PQP.Language.Type.AnyInstance;

                case PQP.Language.Type.ExtendedTypeKind.DefinedRecord:
                case PQP.Language.Type.ExtendedTypeKind.DefinedTable: {
                    const maybeNamedField:
                        | PQP.Language.Type.TPowerQueryType
                        | undefined = previousSiblingType.fields.get(fieldName);
                    if (maybeNamedField !== undefined) {
                        return maybeNamedField;
                    } else if (previousSiblingType.isOpen) {
                        return PQP.Language.Type.AnyInstance;
                    } else {
                        return isOptional ? PQP.Language.Type.NullInstance : PQP.Language.Type.NoneInstance;
                    }
                }

                default:
                    throw Assert.isNever(previousSiblingType);
            }

        default:
            return PQP.Language.Type.NoneInstance;
    }
}

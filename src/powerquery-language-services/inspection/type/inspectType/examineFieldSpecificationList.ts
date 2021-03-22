// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState } from "./common";
import { inspectTypeFieldSpecification } from "./inspectTypeFieldSpecification";

export interface ExaminedFieldSpecificationList {
    readonly fields: Map<string, PQP.Language.Type.PqType>;
    readonly isOpen: boolean;
}

// It's called an examination instead of inspection because it doesn't return TType.
export function examineFieldSpecificationList(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): ExaminedFieldSpecificationList {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.FieldSpecificationList);

    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = state.nodeIdMapCollection;
    const fields: [string, PQP.Language.Type.PqType][] = [];

    for (const fieldSpecification of PQP.Parser.NodeIdMapIterator.iterFieldSpecification(
        nodeIdMapCollection,
        xorNode,
    )) {
        const maybeName:
            | PQP.Language.Ast.TNode
            | undefined = PQP.Parser.NodeIdMapUtils.maybeChildAstByAttributeIndex(
            nodeIdMapCollection,
            fieldSpecification.node.id,
            1,
            [PQP.Language.Ast.NodeKind.GeneralizedIdentifier],
        );

        if (maybeName === undefined) {
            break;
        }
        const name: string = (maybeName as PQP.Language.Ast.GeneralizedIdentifier).literal;
        const type: PQP.Language.Type.PqType = inspectTypeFieldSpecification(state, fieldSpecification);
        fields.push([name, type]);
    }

    const isOpen: boolean =
        PQP.Parser.NodeIdMapUtils.maybeChildAstByAttributeIndex(nodeIdMapCollection, xorNode.node.id, 3, [
            PQP.Language.Ast.NodeKind.Constant,
        ]) !== undefined;

    return {
        fields: new Map(fields),
        isOpen,
    };
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFieldSpecification } from "./inspectTypeFieldSpecification";
import { InspectTypeState } from "./common";

export interface ExaminedFieldSpecificationList {
    readonly fields: Map<string, Type.TPowerQueryType>;
    readonly isOpen: boolean;
}

// It's called an examination instead of inspection because it doesn't return TType.
export function examineFieldSpecificationList(
    state: InspectTypeState,
    xorNode: TXorNode,
): ExaminedFieldSpecificationList {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FieldSpecificationList>(xorNode, Ast.NodeKind.FieldSpecificationList);

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const fields: [string, Type.TPowerQueryType][] = [];

    for (const fieldSpecification of NodeIdMapIterator.iterFieldSpecification(
        nodeIdMapCollection,
        XorNodeUtils.assertAsFunctionParameterList(xorNode),
    )) {
        const maybeName: Ast.GeneralizedIdentifier | undefined = NodeIdMapUtils.maybeUnboxNthChildIfAstChecked(
            nodeIdMapCollection,
            fieldSpecification.node.id,
            1,
            Ast.NodeKind.GeneralizedIdentifier,
        );

        if (maybeName === undefined) {
            break;
        }
        const type: Type.TPowerQueryType = inspectTypeFieldSpecification(state, fieldSpecification);
        fields.push([maybeName.literal, type]);
    }

    const isOpen: boolean =
        NodeIdMapUtils.maybeNthChildChecked(nodeIdMapCollection, xorNode.node.id, 3, Ast.NodeKind.Constant) !==
        undefined;

    return {
        fields: new Map(fields),
        isOpen,
    };
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { assertGetOrCreateNodeScope, InspectTypeState, inspectXor } from "../common";
import { EachScopeItem, ScopeItemKind, ScopeUtils } from "../../../scope";
import { InspectionTraceConstant, TraceUtils } from "../../../..";

// A field selection/projection is an operation a target value,
// where the target is either an EachExpression or a RecursivePrimaryExpression.
// In the code below that target for the FieldSelector/FieldProjection is called the scope.
//
// In the case of EachExpression:
//  use whatever scope was provided in InspectionTypeState.eachScopeById, else Unknown
//
// In the case of RecursivePrimaryExpression:
//  the scope is the previous sibling's type, so use NodeUtils.assertRecursiveExpressionPreviousSibling

export async function inspectFieldType(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectFieldType.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    XorNodeUtils.assertIsNodeKind<Ast.FieldProjection | Ast.FieldSelector>(xorNode, [
        Ast.NodeKind.FieldProjection,
        Ast.NodeKind.FieldSelector,
    ]);

    // travels up the AST to see if we're in an EachExpression or RecursivePrimaryExpression.
    const eachScopeItem: EachScopeItem | undefined = await findEachScopeItem(state, xorNode, trace.correlationId);

    let fieldType: Type.TPowerQueryType;

    // if the scope is an EachExpression
    if (eachScopeItem) {
        fieldType = eachScopeItem.implicitParameterType ?? Type.UnknownInstance;
    }
    // else it must be a RecursivePrimaryExpression,
    // so grab the previous sibling of the FieldProjection/FieldSelector
    else {
        const previousSibling: TXorNode = NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(
            state.nodeIdMapCollection,
            xorNode.node.id,
        );

        fieldType = await inspectXor(state, previousSibling, trace.id);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(fieldType) });

    return fieldType;
}

async function findEachScopeItem(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<EachScopeItem | undefined> {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    let parent: TXorNode | undefined = NodeIdMapUtils.parentXor(nodeIdMapCollection, xorNode.node.id);

    while (parent) {
        if (parent.node.kind === Ast.NodeKind.EachExpression) {
            return ScopeUtils.assertGetScopeItemChecked<EachScopeItem>(
                // eslint-disable-next-line no-await-in-loop
                await assertGetOrCreateNodeScope(state, xorNode.node.id, correlationId),
                "_",
                ScopeItemKind.Each,
            );
        }

        parent = NodeIdMapUtils.parentXor(nodeIdMapCollection, parent.node.id);
    }

    return undefined;
}

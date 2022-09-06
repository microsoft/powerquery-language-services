// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../../..";
import { InspectTypeState, inspectXor } from "../common";

// A field selection/projection is an operation a target value,
// where the target is either an EachExpression or a RecursivePrimaryExpression.
// In the code below that target for the FieldSelector/FieldProjection is called the scope.
//
// In the case of EachExpression:
//  use whatever scope was provided in InspectionTypeState.maybeEachScopeById, else Unknown
//
// In the case of RecursivePrimaryExpression:
//  the scope is the previous sibling's type, so use NodeUtils.assertRecursiveExpressionPreviousSibling

export async function inspectFieldType(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectFieldType.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    XorNodeUtils.assertIsNodeKind<Ast.FieldProjection | Ast.FieldSelector>(xorNode, [
        Ast.NodeKind.FieldProjection,
        Ast.NodeKind.FieldSelector,
    ]);

    // travels up the AST to see if we're in an EachExpression or RecursivePrimaryExpression.
    const maybeEachExpression: XorNode<Ast.EachExpression> | undefined = findEachExpression(state, xorNode);

    let fieldType: Type.TPowerQueryType;

    // if the scope is an EachExpression
    if (maybeEachExpression) {
        fieldType = state.maybeEachScopeById?.get(maybeEachExpression.node.id) ?? Type.UnknownInstance;
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

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(fieldType) });

    return fieldType;
}

function findEachExpression(state: InspectTypeState, xorNode: TXorNode): XorNode<Ast.EachExpression> | undefined {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    let maybeParent: TXorNode | undefined = NodeIdMapUtils.parentXor(nodeIdMapCollection, xorNode.node.id);

    while (maybeParent) {
        switch (maybeParent.node.kind) {
            case Ast.NodeKind.EachExpression:
                return maybeParent as XorNode<Ast.EachExpression>;

            default:
                maybeParent = NodeIdMapUtils.parentXor(nodeIdMapCollection, maybeParent.node.id);
                break;
        }
    }

    return undefined;
}

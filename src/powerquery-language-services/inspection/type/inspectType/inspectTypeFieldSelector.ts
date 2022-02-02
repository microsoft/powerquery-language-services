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
import { CommonError } from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export function inspectTypeFieldSelector(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeFieldSelector.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FieldSelector>(xorNode, Ast.NodeKind.FieldSelector);

    const maybeFieldName: Ast.GeneralizedIdentifier | undefined = NodeIdMapUtils.maybeUnboxWrappedContentIfAstChecked(
        state.nodeIdMapCollection,
        xorNode.node.id,
        Ast.NodeKind.GeneralizedIdentifier,
    );

    if (maybeFieldName === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const fieldName: string = maybeFieldName.literal;
    const fieldScope: FieldScope = getFieldScope(state, xorNode);
    let fieldType: Type.TPowerQueryType;

    switch (fieldScope.node.kind) {
        case Ast.NodeKind.EachExpression:
            fieldType = inspectEachExpressionFieldSelector(state, fieldScope as XorNode<Ast.EachExpression>);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            fieldType = inspectRecursivePrimaryExpressionFieldSelector(
                state,
                fieldScope as XorNode<Ast.RecursivePrimaryExpression>,
            );

            break;

        default:
            // I can't use a `never` assert due to a typing issue it assumes xorNode can be
            // AstXorNode<EachExpression | RecursivePrimaryExpression>,
            // despite that not being possible.
            throw new CommonError.InvariantError(`should never be reached`);
    }

    const isOptional: boolean =
        NodeIdMapUtils.maybeUnboxNthChildIfAstChecked(
            state.nodeIdMapCollection,
            xorNode.node.id,
            3,
            Ast.NodeKind.Constant,
        ) !== undefined;

    const result: Type.TPowerQueryType = getFieldSelectorType(fieldType, fieldName, isOptional);
    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

type FieldScope = XorNode<Ast.EachExpression | Ast.RecursivePrimaryExpression>;

function getFieldScope(state: InspectTypeState, xorNode: TXorNode): FieldScope {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    let maybeParent: TXorNode | undefined = NodeIdMapUtils.maybeParentXor(nodeIdMapCollection, xorNode.node.id);

    while (maybeParent) {
        switch (maybeParent.node.kind) {
            case Ast.NodeKind.EachExpression:
            case Ast.NodeKind.RecursivePrimaryExpression:
                return maybeParent as FieldScope;

            default:
                maybeParent = NodeIdMapUtils.maybeParentXor(nodeIdMapCollection, xorNode.node.id);
                break;
        }
    }

    throw new CommonError.InvariantError(
        `expected FieldSelector to fall under either an EachExpression or a RecursivePrimaryExpression`,
        { nodeId: xorNode.node.id },
    );
}

function getFieldSelectorType(
    fieldType: Type.TPowerQueryType,
    fieldName: string,
    isOptional: boolean,
): Type.TPowerQueryType {
    switch (fieldType.kind) {
        case Type.TypeKind.Any:
            return Type.AnyInstance;

        case Type.TypeKind.Unknown:
            return Type.UnknownInstance;

        case Type.TypeKind.Record:
        case Type.TypeKind.Table:
            return inspectRecordOrTable(fieldType, fieldName, isOptional);

        default:
            return Type.NoneInstance;
    }
}

function inspectRecordOrTable(
    fieldType: Type.TRecord | Type.TTable,
    fieldName: string,
    isOptional: boolean,
): Type.TPowerQueryType {
    if (fieldType.maybeExtendedKind === undefined) {
        return Type.AnyInstance;
    }

    const maybeNamedField: Type.TPowerQueryType | undefined = fieldType.fields.get(fieldName);

    if (maybeNamedField !== undefined) {
        return maybeNamedField;
    } else if (fieldType.isOpen) {
        return Type.AnyInstance;
    } else {
        return isOptional ? Type.NullInstance : Type.NoneInstance;
    }
}

// If we don't know what the scope is for the FieldSelector then return AnyInstance.
function inspectEachExpressionFieldSelector(
    state: InspectTypeState,
    xorNode: XorNode<Ast.EachExpression>,
): Type.TPowerQueryType {
    return state.maybeEachScopeById?.get(xorNode.node.id) ?? Type.UnknownInstance;
}

function inspectRecursivePrimaryExpressionFieldSelector(
    state: InspectTypeState,
    xorNode: XorNode<Ast.RecursivePrimaryExpression>,
): Type.TPowerQueryType {
    const previousSibling: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    return inspectXor(state, previousSibling);
}

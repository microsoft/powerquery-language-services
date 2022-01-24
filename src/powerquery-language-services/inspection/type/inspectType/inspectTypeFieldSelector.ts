// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

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
    const fieldScope: FieldScope = getFieldScope();
    let fieldType: Type.TPowerQueryType;

    switch (fieldScope) {
        case FieldScope.EachExpression:
            fieldType = inspectEachExpressionFieldSelector(state, xorNode);
            break;

        case FieldScope.RecursivePrimaryExpression:
            fieldType = inspectRecursivePrimaryExpressionFieldSelector(state, xorNode);
            break;

        default:
            throw Assert.isNever(fieldScope);
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

const enum FieldScope {
    EachExpression = "EachExpression",
    RecursivePrimaryExpression = "RecursivePrimaryExpression",
}

function getFieldScope(): FieldScope {
    // TODO
    return FieldScope.RecursivePrimaryExpression;
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

function inspectEachExpressionFieldSelector(_state: InspectTypeState, _xorNode: TXorNode): Type.TPowerQueryType {
    throw new Error("TODO");
}

function inspectRecursivePrimaryExpressionFieldSelector(
    state: InspectTypeState,
    xorNode: TXorNode,
): Type.TPowerQueryType {
    const previousSibling: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    return inspectXor(state, previousSibling);
}

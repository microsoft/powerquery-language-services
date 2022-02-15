// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { LanguageServiceTraceConstant, TraceUtils } from "../../../..";
import { inspectFieldType } from "./common";
import { InspectTypeState } from "../common";

// A field selection/projection is an operation done on some value.
// The target can be either an EachExpression or a RecursivePrimaryExpression.
// In the code below that target for the FieldSelector/FieldProjection is called the scope.
//
// In the case of EachExpression:
//  use whatever scope was provided in InspectionTypeState.maybeEachScopeById, else Unknown
//
// In the case of RecursivePrimaryExpression:
//  the scope is the previous sibling's type, so use NodeUtils.assertGetRecursiveExpressionPreviousSibling

export function inspectTypeFieldSelector(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeFieldSelector.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FieldSelector>(xorNode, Ast.NodeKind.FieldSelector);

    const maybeFieldName: Ast.GeneralizedIdentifier | undefined =
        NodeIdMapUtils.maybeUnboxWrappedContentIfAstChecked<Ast.GeneralizedIdentifier>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            Ast.NodeKind.GeneralizedIdentifier,
        );

    if (maybeFieldName === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const fieldName: string = maybeFieldName.literal;
    const fieldType: Type.TPowerQueryType = inspectFieldType(state, xorNode);

    const isOptional: boolean =
        NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            3,
            Ast.NodeKind.Constant,
        ) !== undefined;

    const result: Type.TPowerQueryType = getFieldSelectorType(fieldType, fieldName, isOptional);
    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
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

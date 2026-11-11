// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, IdentifierUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { MapUtils } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../../..";
import { inspectFieldType } from "./common";
import { InspectTypeState } from "../inspectTypeState";

// A field selection/projection is an operation done on some value.
// The target can be either an EachExpression or a RecursivePrimaryExpression.
// In the code below that target for the FieldSelector/FieldProjection is called the scope.
//
// In the case of EachExpression:
//  use whatever scope was provided in InspectionTypeState.eachScopeById, else Unknown
//
// In the case of RecursivePrimaryExpression:
//  the scope is the previous sibling's type, so use NodeUtils.assertRecursiveExpressionPreviousSibling

export async function inspectTypeFieldSelector(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeFieldSelector.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FieldSelector>(xorNode, Ast.NodeKind.FieldSelector);

    const fieldName: Ast.GeneralizedIdentifier | undefined =
        NodeIdMapUtils.wrappedContentAstChecked<Ast.GeneralizedIdentifier>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            Ast.NodeKind.GeneralizedIdentifier,
        );

    if (fieldName === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const fieldType: Type.TPowerQueryType = await inspectFieldType(state, xorNode, trace.id);

    const isOptional: boolean =
        NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            3,
            Ast.NodeKind.Constant,
        ) !== undefined;

    const result: Type.TPowerQueryType = getFieldSelectorType(
        fieldType,
        IdentifierUtils.assertNormalizedIdentifier(fieldName.literal, { allowGeneralizedIdentifier: true }),
        isOptional,
    );

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

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
    const unknownFieldType: Type.TPowerQueryType =
        fieldType.kind === Type.TypeKind.Table
            ? TypeUtils.primitiveType(isOptional, Type.TypeKind.List)
            : Type.AnyInstance;

    if (fieldType.extendedKind === undefined) {
        return unknownFieldType;
    }

    const namedField: Type.TPowerQueryType | undefined = fieldType.fields.get(fieldName);

    if (namedField !== undefined) {
        if (fieldType.kind === Type.TypeKind.Table) {
            return fieldType.rows === undefined
                ? Type.ListInstance
                : TypeUtils.definedList(
                      false,
                      fieldType.rows.map((row: Type.UnorderedFields) => MapUtils.assertGet(row, fieldName)),
                  );
        }

        return namedField;
    } else if (fieldType.isOpen) {
        return unknownFieldType;
    } else {
        return isOptional ? Type.NullInstance : Type.NoneInstance;
    }
}

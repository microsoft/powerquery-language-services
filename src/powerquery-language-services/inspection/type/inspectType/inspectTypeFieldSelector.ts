// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "@microsoft/powerquery-parser";
import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeFieldSelector(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FieldSelector>(xorNode, Ast.NodeKind.FieldSelector);

    const maybeFieldName: Ast.GeneralizedIdentifier | undefined = NodeIdMapUtils.maybeUnboxWrappedContentIfAstChecked(
        state.nodeIdMapCollection,
        xorNode.node.id,
        Ast.NodeKind.GeneralizedIdentifier,
    );
    if (maybeFieldName === undefined) {
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

    return getFieldSelectorType(fieldType, fieldName, isOptional);
}

const enum FieldScope {
    EachExpression,
    RecursivePrimaryExpression,
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
            switch (fieldType.maybeExtendedKind) {
                case undefined:
                    return Type.AnyInstance;

                case Type.ExtendedTypeKind.DefinedRecord:
                case Type.ExtendedTypeKind.DefinedTable: {
                    const maybeNamedField: Type.TPowerQueryType | undefined = fieldType.fields.get(fieldName);
                    if (maybeNamedField !== undefined) {
                        return maybeNamedField;
                    } else if (fieldType.isOpen) {
                        return Type.AnyInstance;
                    } else {
                        return isOptional ? Type.NullInstance : Type.NoneInstance;
                    }
                }

                default:
                    throw Assert.isNever(fieldType);
            }

        default:
            return Type.NoneInstance;
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

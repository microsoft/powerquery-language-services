// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeLeafKind, ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";

export type TriedExpectedType = PQP.Result<PQP.Language.Type.PqType | undefined, PQP.CommonError.CommonError>;

export function tryExpectedType(settings: PQP.CommonSettings, maybeActiveNode: TMaybeActiveNode): TriedExpectedType {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return PQP.ResultUtils.okFactory(undefined);
    }

    return PQP.ResultUtils.ensureResult(settings.locale, () => maybeExpectedType(maybeActiveNode));
}

// Traverse up the ancestry and find what type is expected as the nth child of a node's kind.
// The last type generated this way should have the widest typing,
// which then can be used for type hinting.
export function maybeExpectedType(activeNode: ActiveNode): PQP.Language.Type.PqType | undefined {
    const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;
    const upperBound: number = ancestry.length - 1;
    let bestMatch: PQP.Language.Type.PqType | undefined;

    for (let index: number = 0; index < upperBound; index += 1) {
        const parent: PQP.Parser.TXorNode = ancestry[index + 1];
        const child: PQP.Parser.TXorNode = ancestry[index];
        const childAttributeIndex: number = PQP.Assert.asDefined(
            child.node.maybeAttributeIndex,
            `Expected child to have an attribute index.`,
            { childId: child.node.id },
        );

        const attributeIndex: number =
            parent.kind === PQP.Parser.XorNodeKind.Ast && activeNode.leafKind === ActiveNodeLeafKind.AfterAstNode
                ? childAttributeIndex + 1
                : childAttributeIndex;

        const allowedType: PQP.Language.Type.PqType = expectedType(parent, attributeIndex);
        if (allowedType.kind !== PQP.Language.Type.TypeKind.NotApplicable) {
            bestMatch = allowedType;
        }
    }

    return bestMatch;
}

// For a given parent node, what is the expected type for a child at a given index?
export function expectedType(parentXorNode: PQP.Parser.TXorNode, childIndex: number): PQP.Language.Type.PqType {
    switch (parentXorNode.node.kind) {
        case PQP.Language.Ast.NodeKind.ArrayWrapper:
        case PQP.Language.Ast.NodeKind.Constant:
        case PQP.Language.Ast.NodeKind.Csv:
        case PQP.Language.Ast.NodeKind.GeneralizedIdentifier:
        case PQP.Language.Ast.NodeKind.Identifier:
        case PQP.Language.Ast.NodeKind.IdentifierExpression:
        case PQP.Language.Ast.NodeKind.InvokeExpression:
        case PQP.Language.Ast.NodeKind.FieldProjection:
        case PQP.Language.Ast.NodeKind.FieldSelector:
        case PQP.Language.Ast.NodeKind.FieldSpecificationList:
        case PQP.Language.Ast.NodeKind.ListExpression:
        case PQP.Language.Ast.NodeKind.ListLiteral:
        case PQP.Language.Ast.NodeKind.LiteralExpression:
        case PQP.Language.Ast.NodeKind.RecordLiteral:
        case PQP.Language.Ast.NodeKind.RecordType:
        case PQP.Language.Ast.NodeKind.Parameter:
        case PQP.Language.Ast.NodeKind.ParameterList:
        case PQP.Language.Ast.NodeKind.PrimitiveType:
        case PQP.Language.Ast.NodeKind.RecordExpression:
        case PQP.Language.Ast.NodeKind.RecursivePrimaryExpression:
            return PQP.Language.Type.NotApplicableInstance;

        case PQP.Language.Ast.NodeKind.ArithmeticExpression:
        case PQP.Language.Ast.NodeKind.EqualityExpression:
        case PQP.Language.Ast.NodeKind.LogicalExpression:
        case PQP.Language.Ast.NodeKind.RelationalExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return PQP.Language.Type.TypeExpressionInstance;

                case 1:
                    return PQP.Language.Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.AsExpression:
        case PQP.Language.Ast.NodeKind.IsExpression:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.TypeExpressionInstance;

                case 1:
                    return PQP.Language.Type.NotApplicableInstance;

                case 2:
                    return PQP.Language.Type.NullablePrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.Section:
        case PQP.Language.Ast.NodeKind.SectionMember:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.RecordInstance;

                default:
                    return PQP.Language.Type.NotApplicableInstance;
            }

        case PQP.Language.Ast.NodeKind.AsType:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.AsNullablePrimitiveType:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.NullablePrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.EachExpression:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.ErrorHandlingExpression:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.ExpressionInstance;

                case 2:
                    return PQP.Language.Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        // TODO: how should error raising be typed?
        case PQP.Language.Ast.NodeKind.ErrorRaisingExpression:
            return PQP.Language.Type.NotApplicableInstance;

        case PQP.Language.Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
            switch (childIndex) {
                case 0:
                case 1:
                    return PQP.Language.Type.NotApplicableInstance;

                case 2:
                    return PQP.Language.Type.AnyLiteralInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case PQP.Language.Ast.NodeKind.IdentifierPairedExpression:
            switch (childIndex) {
                case 0:
                case 1:
                    return PQP.Language.Type.NotApplicableInstance;

                case 2:
                    return PQP.Language.Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.FieldSpecification:
            switch (childIndex) {
                case 0:
                case 1:
                    return PQP.Language.Type.NotApplicableInstance;

                case 2:
                    return PQP.Language.Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.FieldTypeSpecification:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.FunctionExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.NullablePrimitiveInstance;

                case 3:
                    return PQP.Language.Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.FunctionType:
            switch (childIndex) {
                case 0:
                case 1:
                    return PQP.Language.Type.NotApplicableInstance;

                case 2:
                    return PQP.Language.Type.NullablePrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.IfExpression:
            switch (childIndex) {
                case 0:
                case 2:
                case 4:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.LogicalInstance;

                case 3:
                case 5:
                    return PQP.Language.Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.IsNullablePrimitiveType:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.NullablePrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.ItemAccessExpression:
            switch (childIndex) {
                case 0:
                case 2:
                case 3:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.LetExpression:
            switch (childIndex) {
                case 0:
                case 1:
                case 2:
                    return PQP.Language.Type.NotApplicableInstance;

                case 3:
                    return PQP.Language.Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.ListType:
            switch (childIndex) {
                case 0:
                case 2:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.MetadataExpression:
            switch (childIndex) {
                case 1:
                    return PQP.Language.Type.NotApplicableInstance;

                case 0:
                case 2:
                    return PQP.Language.Type.TypeExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.NotImplementedExpression:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.NullCoalescingExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return PQP.Language.Type.ExpressionInstance;

                case 1:
                    return PQP.Language.Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.NullablePrimitiveType:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.PrimitiveInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.NullableType:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.TypeProductionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.OtherwiseExpression:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.ParenthesizedExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.ExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.RangeExpression:
            switch (childIndex) {
                case 0:
                case 2:
                    return PQP.Language.Type.ExpressionInstance;

                case 1:
                    return PQP.Language.Type.NotApplicableInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.TableType:
            switch (childIndex) {
                case 1:
                case 2:
                    return PQP.Language.Type.PrimaryExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.TypePrimaryType:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.PrimaryTypeInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        case PQP.Language.Ast.NodeKind.UnaryExpression:
            switch (childIndex) {
                case 0:
                    return PQP.Language.Type.NotApplicableInstance;

                case 1:
                    return PQP.Language.Type.TypeExpressionInstance;

                default:
                    throw unknownChildIndexError(parentXorNode, childIndex);
            }

        default:
            throw PQP.Assert.isNever(parentXorNode.node);
    }
}

function unknownChildIndexError(parent: PQP.Parser.TXorNode, childIndex: number): PQP.CommonError.InvariantError {
    const details: {} = {
        parentId: parent.node.kind,
        parentNodeKind: parent.node.kind,
        childIndex,
    };
    return new PQP.CommonError.InvariantError(`unknown childIndex`, details);
}

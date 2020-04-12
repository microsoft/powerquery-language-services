// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export type LinearLengthMap = Map<number, number>;

// Lazy evaluation of a potentially large PQP.AST.
// Returns the text length of the node if IsMultiline is set to false.
// Nodes which can't ever have a linear length (such as IfExpressions) will evaluate to NaN.
export function getLinearLength(
    localizationTemplates: PQP.ILocalizationTemplates,
    nodeIdMapCollection: PQP.NodeIdMap.Collection,
    linearLengthMap: LinearLengthMap,
    node: PQP.Ast.TNode,
): number {
    const nodeId: number = node.id;
    const maybeLinearLength: number | undefined = linearLengthMap.get(nodeId);

    if (maybeLinearLength === undefined) {
        const linearLength: number = calculateLinearLength(
            localizationTemplates,
            node,
            nodeIdMapCollection,
            linearLengthMap,
        );
        linearLengthMap.set(nodeId, linearLength);
        return linearLength;
    } else {
        return maybeLinearLength;
    }
}

interface State extends PQP.Traverse.IState<number> {
    readonly nodeIdMapCollection: PQP.NodeIdMap.Collection;
    readonly linearLengthMap: LinearLengthMap;
}

function calculateLinearLength(
    localizationTemplates: PQP.ILocalizationTemplates,
    node: PQP.Ast.TNode,
    nodeIdMapCollection: PQP.NodeIdMap.Collection,
    linearLengthMap: LinearLengthMap,
): number {
    const state: State = {
        localizationTemplates,
        result: 0,
        nodeIdMapCollection,
        linearLengthMap,
    };

    const triedTraverse: PQP.Traverse.TriedTraverse<number> = PQP.Traverse.tryTraverseAst(
        state,
        nodeIdMapCollection,
        node,
        PQP.Traverse.VisitNodeStrategy.DepthFirst,
        visitNode,
        PQP.Traverse.expectExpandAllAstChildren,
        undefined,
    );

    if (PQP.ResultUtils.isErr(triedTraverse)) {
        throw triedTraverse.error;
    } else {
        return triedTraverse.value;
    }
}

function visitNode(state: State, node: PQP.Ast.TNode): void {
    let linearLength: number;

    switch (node.kind) {
        // TPairedConstant
        case PQP.Ast.NodeKind.AsNullablePrimitiveType:
        case PQP.Ast.NodeKind.AsType:
        case PQP.Ast.NodeKind.EachExpression:
        case PQP.Ast.NodeKind.ErrorRaisingExpression:
        case PQP.Ast.NodeKind.IsNullablePrimitiveType:
        case PQP.Ast.NodeKind.NullablePrimitiveType:
        case PQP.Ast.NodeKind.NullableType:
        case PQP.Ast.NodeKind.OtherwiseExpression:
        case PQP.Ast.NodeKind.TypePrimaryType:
            linearLength = sumLinearLengths(state, 1, node.constant, node.paired);
            break;

        // TBinOpExpression
        case PQP.Ast.NodeKind.AsExpression:
        case PQP.Ast.NodeKind.ArithmeticExpression:
        case PQP.Ast.NodeKind.EqualityExpression:
        case PQP.Ast.NodeKind.IsExpression:
        case PQP.Ast.NodeKind.LogicalExpression:
        case PQP.Ast.NodeKind.RelationalExpression: {
            linearLength = sumLinearLengths(state, 2, node.left, node.operatorConstant, node.right);
            break;
        }

        // TKeyValuePair
        case PQP.Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case PQP.Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case PQP.Ast.NodeKind.IdentifierPairedExpression:
            linearLength = sumLinearLengths(state, 2, node.key, node.equalConstant, node.value);
            break;

        // TWrapped where Content is TCsv[] and no extra attributes
        case PQP.Ast.NodeKind.InvokeExpression:
        case PQP.Ast.NodeKind.ListExpression:
        case PQP.Ast.NodeKind.ListLiteral:
        case PQP.Ast.NodeKind.ParameterList:
        case PQP.Ast.NodeKind.RecordExpression:
        case PQP.Ast.NodeKind.RecordLiteral: {
            const elements: ReadonlyArray<PQP.Ast.TCsv> = node.content.elements;
            const numElements: number = elements.length;
            linearLength = sumLinearLengths(
                state,
                numElements ? numElements - 1 : 0,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                ...elements,
            );
            break;
        }

        case PQP.Ast.NodeKind.ArrayWrapper:
            linearLength = sumLinearLengths(state, 0, ...node.elements);
            break;

        case PQP.Ast.NodeKind.Constant:
            linearLength = node.constantKind.length;
            break;

        case PQP.Ast.NodeKind.Csv:
            linearLength = sumLinearLengths(state, 0, node.node, node.maybeCommaConstant);
            break;

        case PQP.Ast.NodeKind.ErrorHandlingExpression: {
            let initialLength: number = 1;
            if (node.maybeOtherwiseExpression) {
                initialLength += 2;
            }
            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.tryConstant,
                node.protectedExpression,
                node.maybeOtherwiseExpression,
            );
            break;
        }

        case PQP.Ast.NodeKind.FieldProjection:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
                ...node.content.elements,
            );
            break;

        case PQP.Ast.NodeKind.FieldSelector:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
            );
            break;

        case PQP.Ast.NodeKind.FieldSpecification:
            linearLength = sumLinearLengths(
                state,
                0,
                node.maybeOptionalConstant,
                node.name,
                node.maybeFieldTypeSpecification,
            );
            break;

        case PQP.Ast.NodeKind.FieldSpecificationList: {
            const elements: ReadonlyArray<PQP.Ast.ICsv<PQP.Ast.FieldSpecification>> = node.content.elements;
            let initialLength: number = 0;
            if (node.maybeOpenRecordMarkerConstant && elements.length) {
                initialLength += 2;
            }
            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                node.maybeOpenRecordMarkerConstant,
                ...elements,
            );
            break;
        }

        case PQP.Ast.NodeKind.FieldTypeSpecification:
            linearLength = sumLinearLengths(state, 2, node.equalConstant, node.fieldType);
            break;

        case PQP.Ast.NodeKind.FunctionExpression: {
            let initialLength: number = 2;
            if (node.maybeFunctionReturnType) {
                initialLength += 2;
            }
            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.parameters,
                node.maybeFunctionReturnType,
                node.fatArrowConstant,
                node.expression,
            );
            break;
        }

        case PQP.Ast.NodeKind.FunctionType:
            linearLength = sumLinearLengths(state, 2, node.functionConstant, node.parameters, node.functionReturnType);
            break;

        case PQP.Ast.NodeKind.GeneralizedIdentifier:
        case PQP.Ast.NodeKind.Identifier:
            linearLength = node.literal.length;
            break;

        case PQP.Ast.NodeKind.IdentifierExpression:
            linearLength = sumLinearLengths(state, 0, node.maybeInclusiveConstant, node.identifier);
            break;

        case PQP.Ast.NodeKind.ItemAccessExpression:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
            );
            break;

        case PQP.Ast.NodeKind.LiteralExpression:
            linearLength = node.literal.length;
            break;

        case PQP.Ast.NodeKind.ListType:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case PQP.Ast.NodeKind.MetadataExpression: {
            linearLength = sumLinearLengths(state, 2, node.left, node.operatorConstant, node.right);
            break;
        }

        case PQP.Ast.NodeKind.NotImplementedExpression:
            linearLength = sumLinearLengths(state, 0, node.ellipsisConstant);
            break;

        case PQP.Ast.NodeKind.Parameter: {
            let initialLength: number = 0;
            if (node.maybeOptionalConstant) {
                initialLength += 1;
            }
            if (node.maybeParameterType) {
                initialLength += 1;
            }
            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.maybeOptionalConstant,
                node.name,
                node.maybeParameterType,
            );
            break;
        }

        case PQP.Ast.NodeKind.ParenthesizedExpression:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case PQP.Ast.NodeKind.PrimitiveType:
            linearLength = getLinearLength(
                state.localizationTemplates,
                state.nodeIdMapCollection,
                state.linearLengthMap,
                node.primitiveType,
            );
            break;

        case PQP.Ast.NodeKind.RangeExpression:
            linearLength = sumLinearLengths(state, 0, node.left, node.rangeConstant, node.right);
            break;

        case PQP.Ast.NodeKind.RecordType:
            linearLength = sumLinearLengths(state, 0, node.fields);
            break;

        case PQP.Ast.NodeKind.RecursivePrimaryExpression:
            linearLength = sumLinearLengths(state, 0, node.head, ...node.recursiveExpressions.elements);
            break;

        case PQP.Ast.NodeKind.SectionMember: {
            let initialLength: number = 0;
            if (node.maybeLiteralAttributes) {
                initialLength += 1;
            }
            if (node.maybeSharedConstant) {
                initialLength += 1;
            }

            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.maybeLiteralAttributes,
                node.maybeSharedConstant,
                node.namePairedExpression,
                node.semicolonConstant,
            );
            break;
        }

        case PQP.Ast.NodeKind.Section: {
            const sectionMembers: ReadonlyArray<PQP.Ast.SectionMember> = node.sectionMembers.elements;
            if (sectionMembers.length) {
                linearLength = NaN;
            } else {
                let initialLength: number = 0;
                if (node.maybeLiteralAttributes) {
                    initialLength += 1;
                }
                if (node.maybeName) {
                    initialLength += 1;
                }

                linearLength = sumLinearLengths(
                    state,
                    initialLength,
                    node.maybeLiteralAttributes,
                    node.sectionConstant,
                    node.maybeName,
                    node.semicolonConstant,
                    ...sectionMembers,
                );
            }
            break;
        }

        case PQP.Ast.NodeKind.TableType:
            linearLength = sumLinearLengths(state, 1, node.tableConstant, node.rowType);
            break;

        case PQP.Ast.NodeKind.UnaryExpression:
            linearLength = sumLinearLengths(state, 1, node.typeExpression, ...node.operators.elements);
            break;

        // is always multiline, therefore cannot have linear line length
        case PQP.Ast.NodeKind.IfExpression:
        case PQP.Ast.NodeKind.LetExpression:
            linearLength = NaN;
            break;

        default:
            throw PQP.isNever(node);
    }

    state.linearLengthMap.set(node.id, linearLength);
    state.result = linearLength;
}

function sumLinearLengths(state: State, initialLength: number, ...maybeNodes: (PQP.Ast.TNode | undefined)[]): number {
    let summedLinearLength: number = initialLength;
    for (const maybeNode of maybeNodes) {
        if (maybeNode) {
            const nodeLinearLength: number = getLinearLength(
                state.localizationTemplates,
                state.nodeIdMapCollection,
                state.linearLengthMap,
                maybeNode,
            );
            summedLinearLength += nodeLinearLength;
        }
    }

    return summedLinearLength;
}

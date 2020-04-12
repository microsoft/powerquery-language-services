// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CommentCollection, CommentCollectionMap } from "../comment";
import { expectGetIsMultiline, IsMultilineMap, setIsMultiline } from "./common";
import { getLinearLength, LinearLengthMap } from "./linearLength";

export function tryTraverse(
    localizationTemplates: PQP.ILocalizationTemplates,
    ast: PQP.Ast.TNode,
    commentCollectionMap: CommentCollectionMap,
    nodeIdMapCollection: PQP.NodeIdMap.Collection,
): PQP.Traverse.TriedTraverse<IsMultilineMap> {
    const state: State = {
        localizationTemplates,
        result: new Map(),
        commentCollectionMap,
        nodeIdMapCollection,
        linearLengthMap: new Map(),
    };

    return PQP.Traverse.tryTraverseAst<State, IsMultilineMap>(
        state,
        nodeIdMapCollection,
        ast,
        PQP.Traverse.VisitNodeStrategy.DepthFirst,
        visitNode,
        PQP.Traverse.expectExpandAllAstChildren,
        undefined,
    );
}

export interface State extends PQP.Traverse.IState<IsMultilineMap> {
    readonly localizationTemplates: PQP.ILocalizationTemplates;
    readonly commentCollectionMap: CommentCollectionMap;
    readonly nodeIdMapCollection: PQP.NodeIdMap.Collection;
    readonly linearLengthMap: LinearLengthMap;
}

const InvokeExpressionIdentifierLinearLengthExclusions: ReadonlyArray<string> = [
    "#datetime",
    "#datetimezone",
    "#duration",
    "#time",
];
const TBinOpExpressionLinearLengthThreshold: number = 40;
const InvokeExpressionLinearLengthThreshold: number = 40;

function visitNode(state: State, node: PQP.Ast.TNode): void {
    const isMultilineMap: IsMultilineMap = state.result;
    let isMultiline: boolean = false;

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
            isMultiline = isAnyMultiline(isMultilineMap, node.constant, node.paired);
            break;

        // TBinOpExpression
        case PQP.Ast.NodeKind.IsExpression:
        case PQP.Ast.NodeKind.AsExpression:
        case PQP.Ast.NodeKind.ArithmeticExpression:
        case PQP.Ast.NodeKind.EqualityExpression:
        case PQP.Ast.NodeKind.LogicalExpression:
        case PQP.Ast.NodeKind.RelationalExpression: {
            const left: PQP.Ast.TNode = node.left;
            const right: PQP.Ast.TNode = node.right;

            if (
                (PQP.AstUtils.isTBinOpExpression(left) && containsLogicalExpression(left)) ||
                (PQP.AstUtils.isTBinOpExpression(right) && containsLogicalExpression(right))
            ) {
                isMultiline = true;
            }
            const linearLength: number = getLinearLength(
                state.localizationTemplates,
                state.nodeIdMapCollection,
                state.linearLengthMap,
                node,
            );
            if (linearLength > TBinOpExpressionLinearLengthThreshold) {
                isMultiline = true;
            } else {
                isMultiline = isAnyMultiline(isMultilineMap, left, node.operatorConstant, right);
            }

            break;
        }

        // TKeyValuePair
        case PQP.Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case PQP.Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case PQP.Ast.NodeKind.IdentifierPairedExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.key, node.equalConstant, node.value);
            break;

        // Possible for a parent to assign an isMultiline override.
        case PQP.Ast.NodeKind.ArrayWrapper:
            isMultiline = isAnyMultiline(isMultilineMap, ...node.elements);
            break;

        case PQP.Ast.NodeKind.ListExpression:
        case PQP.Ast.NodeKind.ListLiteral:
        case PQP.Ast.NodeKind.RecordExpression:
        case PQP.Ast.NodeKind.RecordLiteral: {
            if (node.content.elements.length > 1) {
                isMultiline = true;
            } else {
                const isAnyChildMultiline: boolean = isAnyMultiline(
                    isMultilineMap,
                    node.openWrapperConstant,
                    node.closeWrapperConstant,
                    ...node.content.elements,
                );
                if (isAnyChildMultiline) {
                    isMultiline = true;
                } else {
                    const csvs: ReadonlyArray<PQP.Ast.TCsv> = node.content.elements;
                    const csvNodes: ReadonlyArray<PQP.Ast.TNode> = csvs.map((csv: PQP.Ast.TCsv) => csv.node);
                    isMultiline = isAnyListOrRecord(csvNodes);
                }
            }

            setIsMultiline(isMultilineMap, node.content, isMultiline);
            break;
        }

        case PQP.Ast.NodeKind.Csv:
            isMultiline = isAnyMultiline(isMultilineMap, node.node, node.maybeCommaConstant);
            break;

        case PQP.Ast.NodeKind.ErrorHandlingExpression:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.tryConstant,
                node.protectedExpression,
                node.maybeOtherwiseExpression,
            );
            break;

        case PQP.Ast.NodeKind.FieldProjection:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
                ...node.content.elements,
            );
            break;

        case PQP.Ast.NodeKind.FieldSelector:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
            );
            break;

        case PQP.Ast.NodeKind.FieldSpecification:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.maybeOptionalConstant,
                node.name,
                node.maybeFieldTypeSpecification,
            );
            break;

        case PQP.Ast.NodeKind.FieldSpecificationList: {
            const fieldArray: PQP.Ast.ICsvArray<PQP.Ast.FieldSpecification> = node.content;
            const fields: ReadonlyArray<PQP.Ast.ICsv<PQP.Ast.FieldSpecification>> = fieldArray.elements;
            if (fields.length > 1) {
                isMultiline = true;
            } else if (fields.length === 1 && node.maybeOpenRecordMarkerConstant) {
                isMultiline = true;
            }
            setIsMultiline(isMultilineMap, fieldArray, isMultiline);
            break;
        }

        case PQP.Ast.NodeKind.FieldTypeSpecification:
            isMultiline = isAnyMultiline(isMultilineMap, node.equalConstant, node.fieldType);
            break;

        case PQP.Ast.NodeKind.FunctionExpression:
            isMultiline = expectGetIsMultiline(isMultilineMap, node.expression);
            break;

        case PQP.Ast.NodeKind.IdentifierExpression: {
            isMultiline = isAnyMultiline(isMultilineMap, node.maybeInclusiveConstant, node.identifier);
            break;
        }

        case PQP.Ast.NodeKind.IfExpression:
            isMultiline = true;
            break;

        case PQP.Ast.NodeKind.InvokeExpression: {
            const nodeIdMapCollection: PQP.NodeIdMap.Collection = state.nodeIdMapCollection;
            const args: ReadonlyArray<PQP.Ast.ICsv<PQP.Ast.TExpression>> = node.content.elements;

            if (args.length > 1) {
                const linearLengthMap: LinearLengthMap = state.linearLengthMap;
                const linearLength: number = getLinearLength(
                    state.localizationTemplates,
                    nodeIdMapCollection,
                    linearLengthMap,
                    node,
                );

                const maybeArrayWrapper: PQP.Ast.TNode | undefined = PQP.NodeIdMapUtils.maybeParentAstNode(
                    nodeIdMapCollection,
                    node.id,
                );
                if (maybeArrayWrapper === undefined || maybeArrayWrapper.kind !== PQP.Ast.NodeKind.ArrayWrapper) {
                    throw new PQP.CommonError.InvariantError("InvokeExpression must have ArrayWrapper as a parent");
                }
                const arrayWrapper: PQP.Ast.IArrayWrapper<PQP.Ast.TNode> = maybeArrayWrapper;

                const maybeRecursivePrimaryExpression:
                    | PQP.Ast.TNode
                    | undefined = PQP.NodeIdMapUtils.maybeParentAstNode(nodeIdMapCollection, arrayWrapper.id);
                if (
                    maybeRecursivePrimaryExpression === undefined ||
                    maybeRecursivePrimaryExpression.kind !== PQP.Ast.NodeKind.RecursivePrimaryExpression
                ) {
                    throw new PQP.CommonError.InvariantError(
                        "ArrayWrapper must have RecursivePrimaryExpression as a parent",
                    );
                }
                const recursivePrimaryExpression: PQP.Ast.RecursivePrimaryExpression = maybeRecursivePrimaryExpression;

                const headLinearLength: number = getLinearLength(
                    state.localizationTemplates,
                    nodeIdMapCollection,
                    linearLengthMap,
                    recursivePrimaryExpression.head,
                );
                const compositeLinearLength: number = headLinearLength + linearLength;

                // if it's beyond the threshold check if it's a long literal
                // ex. `#datetimezone(2013,02,26, 09,15,00, 09,00)`
                if (compositeLinearLength > InvokeExpressionLinearLengthThreshold) {
                    const maybeName: string | undefined = PQP.NodeIdMapUtils.maybeInvokeExpressionName(
                        nodeIdMapCollection,
                        node.id,
                    );
                    if (maybeName) {
                        const name: string = maybeName;
                        isMultiline = InvokeExpressionIdentifierLinearLengthExclusions.indexOf(name) === -1;
                    }

                    setIsMultiline(isMultilineMap, node.content, isMultiline);
                } else {
                    isMultiline = isAnyMultiline(
                        isMultilineMap,
                        node.openWrapperConstant,
                        node.closeWrapperConstant,
                        ...args,
                    );
                }
            } else {
                // a single argument can still be multiline
                // ex. `foo(if true then 1 else 0)`
                isMultiline = isAnyMultiline(
                    isMultilineMap,
                    node.openWrapperConstant,
                    node.closeWrapperConstant,
                    ...args,
                );
            }
            break;
        }

        case PQP.Ast.NodeKind.ItemAccessExpression:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.maybeOptionalConstant,
                node.content,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
            );
            break;

        case PQP.Ast.NodeKind.LetExpression:
            isMultiline = true;
            setIsMultiline(isMultilineMap, node.variableList, true);
            break;

        case PQP.Ast.NodeKind.LiteralExpression:
            if (node.literalKind === PQP.Ast.LiteralKind.Text && containsNewline(node.literal)) {
                isMultiline = true;
            }
            break;

        case PQP.Ast.NodeKind.ListType:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case PQP.Ast.NodeKind.MetadataExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.left, node.operatorConstant, node.right);
            break;

        case PQP.Ast.NodeKind.ParenthesizedExpression:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case PQP.Ast.NodeKind.PrimitiveType:
            isMultiline = expectGetIsMultiline(isMultilineMap, node.primitiveType);
            break;

        case PQP.Ast.NodeKind.RangeExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.left, node.rangeConstant, node.right);
            break;

        case PQP.Ast.NodeKind.RecordType:
            isMultiline = expectGetIsMultiline(isMultilineMap, node.fields);
            break;

        case PQP.Ast.NodeKind.RecursivePrimaryExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.head, ...node.recursiveExpressions.elements);
            break;

        case PQP.Ast.NodeKind.Section:
            if (node.sectionMembers.elements.length) {
                isMultiline = true;
            } else {
                isMultiline = isAnyMultiline(
                    isMultilineMap,
                    node.maybeLiteralAttributes,
                    node.sectionConstant,
                    node.maybeName,
                    node.semicolonConstant,
                    ...node.sectionMembers.elements,
                );
            }
            break;

        case PQP.Ast.NodeKind.SectionMember:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.maybeLiteralAttributes,
                node.maybeSharedConstant,
                node.namePairedExpression,
                node.semicolonConstant,
            );
            break;

        case PQP.Ast.NodeKind.TableType:
            isMultiline = isAnyMultiline(isMultilineMap, node.tableConstant, node.rowType);
            break;

        case PQP.Ast.NodeKind.UnaryExpression:
            isMultiline = isAnyMultiline(isMultilineMap, ...node.operators.elements);
            break;

        // no-op nodes
        case PQP.Ast.NodeKind.Constant:
        case PQP.Ast.NodeKind.FunctionType:
        case PQP.Ast.NodeKind.GeneralizedIdentifier:
        case PQP.Ast.NodeKind.Identifier:
        case PQP.Ast.NodeKind.NotImplementedExpression:
        case PQP.Ast.NodeKind.Parameter:
        case PQP.Ast.NodeKind.ParameterList:
            break;

        default:
            throw PQP.isNever(node);
    }

    setIsMultilineWithCommentCheck(state, node, isMultiline);
}

function isAnyListOrRecord(nodes: ReadonlyArray<PQP.Ast.TNode>): boolean {
    for (const node of nodes) {
        // tslint:disable-next-line: switch-default
        switch (node.kind) {
            case PQP.Ast.NodeKind.ListExpression:
            case PQP.Ast.NodeKind.ListLiteral:
            case PQP.Ast.NodeKind.RecordExpression:
            case PQP.Ast.NodeKind.RecordLiteral:
                return true;
        }
    }

    return false;
}

function isAnyMultiline(isMultilineMap: IsMultilineMap, ...maybeNodes: (PQP.Ast.TNode | undefined)[]): boolean {
    for (const maybeNode of maybeNodes) {
        if (maybeNode && expectGetIsMultiline(isMultilineMap, maybeNode)) {
            return true;
        }
    }

    return false;
}

function setIsMultilineWithCommentCheck(state: State, node: PQP.Ast.TNode, isMultiline: boolean): void {
    if (precededByMultilineComment(state, node)) {
        isMultiline = true;
    }

    setIsMultiline(state.result, node, isMultiline);
}

function precededByMultilineComment(state: State, node: PQP.Ast.TNode): boolean {
    const maybeCommentCollection: CommentCollection | undefined = state.commentCollectionMap.get(node.id);
    if (maybeCommentCollection) {
        return maybeCommentCollection.prefixedCommentsContainsNewline;
    } else {
        return false;
    }
}

function containsNewline(text: string): boolean {
    const textLength: number = text.length;

    for (let index: number = 0; index < textLength; index += 1) {
        if (PQP.StringUtils.maybeNewlineKindAt(text, index)) {
            return true;
        }
    }
    return false;
}

function containsLogicalExpression(node: PQP.Ast.TBinOpExpression): boolean {
    if (!PQP.AstUtils.isTBinOpExpression(node)) {
        return false;
    }
    const left: PQP.Ast.TNode = node.left;
    const right: PQP.Ast.TNode = node.right;

    return (
        node.kind === PQP.Ast.NodeKind.LogicalExpression ||
        (PQP.AstUtils.isTBinOpExpression(left) && containsLogicalExpression(left)) ||
        (PQP.AstUtils.isTBinOpExpression(right) && containsLogicalExpression(right))
    );
}

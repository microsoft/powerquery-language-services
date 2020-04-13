// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { expectGetIsMultiline, IsMultilineMap, setIsMultiline } from "./common";

export function tryTraverse(
    localizationTemplates: PQP.ILocalizationTemplates,
    ast: PQP.Ast.TNode,
    isMultilineMap: IsMultilineMap,
    nodeIdMapCollection: PQP.NodeIdMap.Collection,
): PQP.Traverse.TriedTraverse<IsMultilineMap> {
    const state: State = {
        localizationTemplates,
        result: isMultilineMap,
        nodeIdMapCollection,
    };

    return PQP.Traverse.tryTraverseAst(
        state,
        nodeIdMapCollection,
        ast,
        PQP.Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        PQP.Traverse.expectExpandAllAstChildren,
        undefined,
    );
}

interface State extends PQP.Traverse.IState<IsMultilineMap> {
    readonly nodeIdMapCollection: PQP.NodeIdMap.Collection;
}

function visitNode(state: State, node: PQP.Ast.TNode): void {
    // tslint:disable-next-line: switch-default
    switch (node.kind) {
        // TBinOpExpression
        case PQP.Ast.NodeKind.ArithmeticExpression:
        case PQP.Ast.NodeKind.AsExpression:
        case PQP.Ast.NodeKind.EqualityExpression:
        case PQP.Ast.NodeKind.IsExpression:
        case PQP.Ast.NodeKind.LogicalExpression:
        case PQP.Ast.NodeKind.RelationalExpression: {
            const isMultilineMap: IsMultilineMap = state.result;
            const maybeParent: PQP.Ast.TNode | undefined = PQP.NodeIdMapUtils.maybeParentAstNode(
                state.nodeIdMapCollection,
                node.id,
            );
            if (
                maybeParent &&
                PQP.AstUtils.isTBinOpExpression(maybeParent) &&
                expectGetIsMultiline(isMultilineMap, maybeParent)
            ) {
                setIsMultiline(isMultilineMap, node, true);
            }
            break;
        }

        // If a list or record is a child node,
        // Then by default it should be considered multiline if it has one or more values
        case PQP.Ast.NodeKind.ListExpression:
        case PQP.Ast.NodeKind.ListLiteral:
        case PQP.Ast.NodeKind.RecordExpression:
        case PQP.Ast.NodeKind.RecordLiteral:
            if (node.content.elements.length) {
                const nodeIdMapCollection: PQP.NodeIdMap.Collection = state.nodeIdMapCollection;

                let maybeParent: PQP.Ast.TNode | undefined = PQP.NodeIdMapUtils.maybeParentAstNode(
                    nodeIdMapCollection,
                    node.id,
                );
                let maybeCsv: PQP.Ast.TCsv | undefined;
                let maybeArrayWrapper: PQP.Ast.TArrayWrapper | undefined;
                if (maybeParent && maybeParent.kind === PQP.Ast.NodeKind.Csv) {
                    maybeCsv = maybeParent;
                    maybeParent = PQP.NodeIdMapUtils.maybeParentAstNode(nodeIdMapCollection, maybeParent.id);
                }
                if (maybeParent && maybeParent.kind === PQP.Ast.NodeKind.ArrayWrapper) {
                    maybeArrayWrapper = maybeParent;
                    maybeParent = PQP.NodeIdMapUtils.maybeParentAstNode(nodeIdMapCollection, maybeParent.id);
                }

                if (maybeParent) {
                    const parent: PQP.Ast.TNode = maybeParent;
                    switch (parent.kind) {
                        case PQP.Ast.NodeKind.ItemAccessExpression:
                        case PQP.Ast.NodeKind.InvokeExpression:
                        case PQP.Ast.NodeKind.FunctionExpression:
                        case PQP.Ast.NodeKind.Section:
                        case PQP.Ast.NodeKind.SectionMember:
                            break;

                        default: {
                            const isMultilineMap: IsMultilineMap = state.result;
                            setIsMultiline(isMultilineMap, parent, true);
                            if (maybeCsv) {
                                setIsMultiline(isMultilineMap, maybeCsv, true);
                            }
                            if (maybeArrayWrapper) {
                                setIsMultiline(isMultilineMap, maybeArrayWrapper, true);
                            }
                            setIsMultiline(isMultilineMap, node, true);
                            setIsMultiline(isMultilineMap, node.content, true);
                        }
                    }
                }
            }
    }
}

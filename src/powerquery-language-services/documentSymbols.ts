// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    NodeIdMap,
    NodeIdMapIterator,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import * as InspectionUtils from "./inspectionUtils";
import { DocumentSymbol, SymbolKind, TextDocument } from "./commonTypes";
import { WorkspaceCacheUtils } from "./workspaceCache";

export async function getDocumentSymbols(
    textDocument: TextDocument,
    lexAndParseSettings: PQP.LexSettings & PQP.ParseSettings,
    isWorkspaceCacheEnabled: boolean,
): Promise<DocumentSymbol[]> {
    const maybeTriedParse: PQP.Task.TriedParseTask | undefined = await WorkspaceCacheUtils.getOrCreateParsePromise(
        textDocument,
        lexAndParseSettings,
        isWorkspaceCacheEnabled,
    );

    if (maybeTriedParse === undefined || PQP.TaskUtils.isParseStageCommonError(maybeTriedParse)) {
        return [];
    }

    const nodeIdMapCollection: NodeIdMap.Collection = maybeTriedParse.nodeIdMapCollection;
    const currentSymbols: DocumentSymbol[] = [];
    const parentSymbolById: Map<number, DocumentSymbol> = new Map();

    addIdentifierPairedExpressionSymbols(nodeIdMapCollection, currentSymbols, parentSymbolById);
    addRecordSymbols(nodeIdMapCollection, currentSymbols, parentSymbolById);
    WorkspaceCacheUtils.close(textDocument);

    return currentSymbols;
}

function addIdentifierPairedExpressionSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    currentSymbols: DocumentSymbol[],
    parentSymbolById: Map<number, DocumentSymbol>,
): void {
    const identifierPairedExpressionIds: Set<number> =
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.IdentifierPairedExpression) ?? new Set();

    const identifierPairedExpressionsXorNodes: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterXor(
        nodeIdMapCollection,
        [...identifierPairedExpressionIds.values()],
    );

    for (const xorNode of identifierPairedExpressionsXorNodes) {
        if (
            !XorNodeUtils.isAstXorChecked<Ast.IdentifierPairedExpression>(
                xorNode,
                Ast.NodeKind.IdentifierPairedExpression,
            )
        ) {
            continue;
        }

        const nodeId: number = xorNode.node.id;
        const documentSymbol: DocumentSymbol = InspectionUtils.getSymbolForIdentifierPairedExpression(xorNode.node);

        addDocumentSymbols(nodeIdMapCollection, parentSymbolById, nodeId, currentSymbols, documentSymbol);
        parentSymbolById.set(nodeId, documentSymbol);
    }
}

function addRecordSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    currentSymbols: DocumentSymbol[],
    parentSymbolById: Map<number, DocumentSymbol>,
): void {
    const recordIds: ReadonlyArray<number> = [
        ...(nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression) ?? new Set()).values(),
        ...(nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordLiteral) ?? new Set()).values(),
    ];

    const recordXorNodes: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterXor(nodeIdMapCollection, recordIds);

    for (const xorNode of recordXorNodes) {
        if (!XorNodeUtils.isAstXor(xorNode)) {
            continue;
        }

        const asAst: Ast.RecordExpression | Ast.RecordLiteral = xorNode.node as
            | Ast.RecordExpression
            | Ast.RecordLiteral;

        // Process the record if the immediate parent is a Struct
        const parentId: number | undefined = nodeIdMapCollection.parentIdById.get(xorNode.node.id);
        const parentSymbol: DocumentSymbol | undefined = parentId ? parentSymbolById.get(parentId) : undefined;

        if (parentSymbol && parentSymbol.kind === SymbolKind.Struct) {
            const fieldSymbols: ReadonlyArray<DocumentSymbol> = InspectionUtils.getSymbolsForRecord(asAst);

            if (fieldSymbols.length > 0) {
                addDocumentSymbols(nodeIdMapCollection, parentSymbolById, asAst.id, currentSymbols, ...fieldSymbols);
            }
        }
    }
}

function addDocumentSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentSymbolById: Map<number, DocumentSymbol>,
    nodeId: number,
    currentSymbols: DocumentSymbol[],
    ...newSymbols: DocumentSymbol[]
): void {
    const parentSymbol: DocumentSymbol | undefined = findParentSymbol(nodeIdMapCollection, parentSymbolById, nodeId);

    if (parentSymbol) {
        if (!parentSymbol.children) {
            parentSymbol.children = [];
        }

        parentSymbol.children.push(...newSymbols);

        return;
    }

    // Add to the top level
    currentSymbols.push(...newSymbols);
}

function findParentSymbol(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentSymbolById: Map<number, DocumentSymbol>,
    nodeId: number,
): DocumentSymbol | undefined {
    // Get parent for current node
    const parentNodeId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);

    if (!parentNodeId) {
        // No more parents to check
        return undefined;
    }

    let parentSymbol: DocumentSymbol | undefined = parentSymbolById.get(parentNodeId);

    if (!parentSymbol) {
        parentSymbol = findParentSymbol(nodeIdMapCollection, parentSymbolById, parentNodeId);
    }

    return parentSymbol;
}

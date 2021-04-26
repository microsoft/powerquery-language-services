// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import * as InspectionUtils from "./inspectionUtils";

import { AnalysisSettings } from "./analysis/analysisSettings";
import { DocumentSymbol, SymbolKind, TextDocument } from "./commonTypes";
import { WorkspaceCache, WorkspaceCacheUtils } from "./workspaceCache";

export function getDocumentSymbols<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    lexAndParseSettings: PQP.LexSettings & PQP.ParseSettings<S>,
    textDocument: TextDocument,
    analysisSettings?: AnalysisSettings<S>,
): DocumentSymbol[] {
    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getOrCreateParse(
        textDocument,
        lexAndParseSettings,
    );

    if (!PQP.TaskUtils.isParseStageOk(cacheItem) && !PQP.TaskUtils.isParseStageParseError(cacheItem)) {
        return [];
    }

    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = cacheItem.nodeIdMapCollection;
    const currentSymbols: DocumentSymbol[] = [];
    const parentSymbolById: Map<number, DocumentSymbol> = new Map();

    addIdentifierPairedExpressionSymbols(nodeIdMapCollection, currentSymbols, parentSymbolById);
    addRecordSymbols(nodeIdMapCollection, currentSymbols, parentSymbolById);

    if (!analysisSettings?.maintainWorkspaceCache) {
        WorkspaceCacheUtils.close(textDocument);
    }

    return currentSymbols;
}

function addIdentifierPairedExpressionSymbols(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    currentSymbols: DocumentSymbol[],
    parentSymbolById: Map<number, DocumentSymbol>,
): void {
    const identifierPairedExpressionIds: Set<number> =
        nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.IdentifierPairedExpression) ?? new Set();
    const identifierPairedExpressionsXorNodes: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.NodeIdMapIterator.assertIterXor(
        nodeIdMapCollection,
        [...identifierPairedExpressionIds.values()],
    );

    for (const xorNode of identifierPairedExpressionsXorNodes) {
        if (!PQP.Parser.XorNodeUtils.isAst(xorNode)) {
            continue;
        }

        const asAst: PQP.Language.Ast.IdentifierPairedExpression = xorNode.node as PQP.Language.Ast.IdentifierPairedExpression;
        const asDocumentSymbol: DocumentSymbol = InspectionUtils.getSymbolForIdentifierPairedExpression(asAst);

        addDocumentSymbols(nodeIdMapCollection, parentSymbolById, asAst.id, currentSymbols, asDocumentSymbol);
        parentSymbolById.set(asAst.id, asDocumentSymbol);
    }
}

function addRecordSymbols(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    currentSymbols: DocumentSymbol[],
    parentSymbolById: Map<number, DocumentSymbol>,
): void {
    const recordIds: ReadonlyArray<number> = [
        ...(nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.RecordExpression) ?? new Set()).values(),
        ...(nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.RecordLiteral) ?? new Set()).values(),
    ];
    const recordXorNodes: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.NodeIdMapIterator.assertIterXor(
        nodeIdMapCollection,
        recordIds,
    );

    for (const xorNode of recordXorNodes) {
        if (!PQP.Parser.XorNodeUtils.isAst(xorNode)) {
            continue;
        }

        const asAst: PQP.Language.Ast.RecordExpression | PQP.Language.Ast.RecordLiteral = xorNode.node as
            | PQP.Language.Ast.RecordExpression
            | PQP.Language.Ast.RecordLiteral;

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
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
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
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
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

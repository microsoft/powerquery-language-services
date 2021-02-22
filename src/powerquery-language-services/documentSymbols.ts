// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import * as InspectionUtils from "./inspectionUtils";
import * as LanguageServiceUtils from "./languageServiceUtils";

import { AnalysisOptions } from "./analysis/analysisOptions";
import { DocumentSymbol, SymbolKind, TextDocument } from "./commonTypes";
import { WorkspaceCache, WorkspaceCacheUtils } from "./workspaceCache";

export function getDocumentSymbols(document: TextDocument, options?: AnalysisOptions): DocumentSymbol[] {
    const cacheItem: WorkspaceCache.TParserCacheItem = WorkspaceCacheUtils.getTriedParse(document, options?.locale);

    let contextState: PQP.Parser.ParseContext.State | undefined;

    switch (cacheItem.stage) {
        case WorkspaceCache.CacheStageKind.Lexer:
        case WorkspaceCache.CacheStageKind.LexerSnapshot:
            contextState = undefined;
            break;

        case WorkspaceCache.CacheStageKind.Parser:
            if (PQP.ResultUtils.isOk(cacheItem)) {
                contextState = cacheItem.value.state.contextState;
            } else if (PQP.Parser.ParseError.isParseError(cacheItem.error)) {
                contextState = cacheItem.error.state.contextState;
            } else {
                contextState = undefined;
            }
            break;

        default:
            throw PQP.Assert.isNever(cacheItem);
    }

    let result: DocumentSymbol[] | undefined;

    if (contextState && contextState.maybeRoot) {
        const rootNode: PQP.Parser.TXorNode = PQP.Parser.XorNodeUtils.contextFactory(contextState.maybeRoot);
        const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = contextState.nodeIdMapCollection;

        const documentOutlineResult: PQP.Traverse.TriedTraverse<DocumentOutline> = tryTraverse(
            rootNode,
            nodeIdMapCollection,
            options,
        );

        // TODO: Trace error case
        if (PQP.ResultUtils.isOk(documentOutlineResult)) {
            result = documentOutlineResult.value.symbols;
        }
    }

    if (!options?.maintainWorkspaceCache) {
        WorkspaceCacheUtils.close(document);
    }

    return result !== undefined ? result : [];
}

interface DocumentOutline {
    readonly symbols: DocumentSymbol[];
}

interface TraversalState extends PQP.Traverse.IState<DocumentOutline> {
    readonly nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection;
    parentSymbolMap: Map<number, DocumentSymbol>;
}

function tryTraverse(
    root: PQP.Parser.TXorNode,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    options?: AnalysisOptions,
): PQP.Traverse.TriedTraverse<DocumentOutline> {
    const locale: string = LanguageServiceUtils.getLocale(options);

    const traversalState: TraversalState = {
        nodeIdMapCollection,
        locale,
        parentSymbolMap: new Map<number, DocumentSymbol>(),
        result: {
            symbols: [],
        },
    };

    return PQP.Traverse.tryTraverseXor(
        traversalState,
        nodeIdMapCollection,
        root,
        PQP.Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        PQP.Traverse.assertGetAllXorChildren,
        earlyExit,
    );
}

// TODO: Optimize this based on the symbols we want to expose in the tree
function earlyExit(_state: TraversalState, currentXorNode: PQP.Parser.TXorNode): boolean {
    return (
        currentXorNode.node.kind === PQP.Language.Ast.NodeKind.ErrorHandlingExpression ||
        currentXorNode.node.kind === PQP.Language.Ast.NodeKind.MetadataExpression
    );
}

function visitNode(state: TraversalState, currentXorNode: PQP.Parser.TXorNode): void {
    // TODO: support processing context nodes
    if (currentXorNode.kind === PQP.Parser.XorNodeKind.Context) {
        return;
    }

    switch (currentXorNode.node.kind) {
        case PQP.Language.Ast.NodeKind.IdentifierPairedExpression:
            const identifierPairedExpressionNode: PQP.Language.Ast.IdentifierPairedExpression = currentXorNode.node as PQP.Language.Ast.IdentifierPairedExpression;
            const currentSymbol: DocumentSymbol = InspectionUtils.getSymbolForIdentifierPairedExpression(
                identifierPairedExpressionNode,
            );
            addDocumentSymbols(identifierPairedExpressionNode.id, state, currentSymbol);
            state.parentSymbolMap.set(identifierPairedExpressionNode.id, currentSymbol);
            break;

        case PQP.Language.Ast.NodeKind.RecordExpression:
        case PQP.Language.Ast.NodeKind.RecordLiteral:
            // Process the record if the immediate parent is a Struct
            const parentId: number | undefined = state.nodeIdMapCollection.parentIdById.get(currentXorNode.node.id);
            const parentSymbol: DocumentSymbol | undefined = parentId ? state.parentSymbolMap.get(parentId) : undefined;
            if (parentSymbol && parentSymbol.kind === SymbolKind.Struct) {
                const fieldSymbols: ReadonlyArray<DocumentSymbol> = InspectionUtils.getSymbolsForRecord(
                    currentXorNode.node,
                );
                if (fieldSymbols.length > 0) {
                    addDocumentSymbols(currentXorNode.node.id, state, ...fieldSymbols);
                }
            }
            break;

        default:
    }
}

function addDocumentSymbols(nodeId: number, state: TraversalState, ...symbols: DocumentSymbol[]): void {
    const parentSymbol: DocumentSymbol | undefined = findParentSymbol(nodeId, state);
    if (parentSymbol) {
        if (!parentSymbol.children) {
            parentSymbol.children = [];
        }

        parentSymbol.children.push(...symbols);
        return;
    }

    // Add to the top level
    state.result.symbols.push(...symbols);
}

function findParentSymbol(nodeId: number, state: TraversalState): DocumentSymbol | undefined {
    // Get parent for current node
    const parentNodeId: number | undefined = state.nodeIdMapCollection.parentIdById.get(nodeId);
    if (!parentNodeId) {
        // No more parents to check
        return undefined;
    }

    let parentSymbol: DocumentSymbol | undefined = state.parentSymbolMap.get(parentNodeId);
    if (!parentSymbol) {
        parentSymbol = findParentSymbol(parentNodeId, state);
    }

    return parentSymbol;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { AnalysisOptions } from "./analysisOptions";
import { DocumentSymbol, TextDocument } from "./commonTypes";
import * as InspectionUtils from "./inspectionUtils";
import * as WorkspaceCache from "./workspaceCache";

const DefaultLocale: string = PQP.Locale.en_US;

export function getDocumentSymbols(document: TextDocument, options?: AnalysisOptions): DocumentSymbol[] {
    const triedLexParse: PQP.Task.TriedLexParse = WorkspaceCache.getTriedLexParse(document);
    let result: DocumentSymbol[] = [];

    let contextState: PQP.ParseContext.State | undefined = undefined;
    if (PQP.ResultUtils.isOk(triedLexParse)) {
        contextState = triedLexParse.value.state.contextState;
    } else if (triedLexParse.error instanceof PQP.ParseError.ParseError) {
        contextState = triedLexParse.error.state.contextState;
    }

    if (contextState && contextState.root.maybeNode) {
        const rootNode: PQP.TXorNode = PQP.NodeIdMapUtils.xorNodeFromContext(contextState.root.maybeNode);
        const nodeIdMapCollection: PQP.NodeIdMap.Collection = contextState.nodeIdMapCollection;

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
        WorkspaceCache.close(document);
    }

    return result;
}

interface DocumentOutline {
    symbols: DocumentSymbol[];
}

interface TraversalState extends PQP.Traverse.IState<DocumentOutline> {
    readonly nodeIdMapCollection: PQP.NodeIdMap.Collection;
    parentSymbolMap: Map<number, DocumentSymbol>;
}

function tryTraverse(
    root: PQP.TXorNode,
    nodeIdMapCollection: PQP.NodeIdMap.Collection,
    options?: AnalysisOptions,
): PQP.Traverse.TriedTraverse<DocumentOutline> {
    const locale: string = options?.locale ?? DefaultLocale;
    const localizationTemplates: PQP.ILocalizationTemplates = PQP.getLocalizationTemplates(locale);

    const traversalState: TraversalState = {
        localizationTemplates,
        nodeIdMapCollection,
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
        PQP.Traverse.expectExpandAllXorChildren,
        earlyExit,
    );
}

// TODO: Optimize this based on the symbols we want to expose in the tree
function earlyExit(_state: TraversalState, currentXorNode: PQP.TXorNode): boolean {
    return (
        currentXorNode.node.kind === PQP.Language.Ast.NodeKind.ErrorHandlingExpression ||
        currentXorNode.node.kind === PQP.Language.Ast.NodeKind.MetadataExpression ||
        currentXorNode.node.kind === PQP.Language.Ast.NodeKind.RecordExpression
    );
}

function visitNode(state: TraversalState, currentXorNode: PQP.TXorNode): void {
    switch (currentXorNode.node.kind) {
        case PQP.Language.Ast.NodeKind.IdentifierPairedExpression:
            // TODO: support processing context nodes
            if (currentXorNode.kind === PQP.XorNodeKind.Context) {
                break;
            }

            const identifierPairedExpressionNode: PQP.Language.Ast.IdentifierPairedExpression = currentXorNode.node as PQP.Language.Ast.IdentifierPairedExpression;
            const currentSymbol: DocumentSymbol = InspectionUtils.getSymbolForIdentifierPairedExpression(
                identifierPairedExpressionNode,
            );
            addDocumentSymbols(identifierPairedExpressionNode.id, state, currentSymbol);
            state.parentSymbolMap.set(identifierPairedExpressionNode.id, currentSymbol);
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

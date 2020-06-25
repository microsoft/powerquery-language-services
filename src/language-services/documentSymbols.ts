// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { AnalysisOptions } from "./analysisOptions";
import { DocumentSymbol, Range, TextDocument } from "./commonTypes";
import * as InspectionUtils from "./inspectionUtils";
import * as LanguageServiceUtils from "./languageServiceUtils";
import * as WorkspaceCache from "./workspaceCache";

const DefaultLocale: string = PQP.Locale.en_US;

export function getDocumentSymbols(document: TextDocument, options?: AnalysisOptions): DocumentSymbol[] {
    const triedLexParse: PQP.Task.TriedLexParse = WorkspaceCache.getTriedLexParse(document);
    let result: DocumentSymbol[] = [];

    // TODO: Can we get symbols even when there is a syntax error?
    if (PQP.ResultUtils.isOk(triedLexParse)) {
        const lexParseOk: PQP.Task.LexParseOk = triedLexParse.value;
        const ast: PQP.Language.Ast.TNode = lexParseOk.ast;
        const nodeIdMapCollection: PQP.NodeIdMap.Collection = lexParseOk.state.contextState.nodeIdMapCollection;

        const documentOutlineResult: PQP.Traverse.TriedTraverse<DocumentOutline> = tryTraverse(
            ast,
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
    ast: PQP.Language.Ast.TNode,
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

    return PQP.Traverse.tryTraverseAst(
        traversalState,
        nodeIdMapCollection,
        ast,
        PQP.Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        PQP.Traverse.expectExpandAllAstChildren,
        undefined,
    );
}

function visitNode(state: TraversalState, node: PQP.Language.Ast.TNode): void {
    let currentSymbol: DocumentSymbol | undefined;

    switch (node.kind) {
        case PQP.Language.Ast.NodeKind.Section:
            // TODO: should the section declaration be the root symbol?
            const sectionSymbol: DocumentSymbol | undefined = createDocumentSymbol(
                node.maybeName,
                node,
                node.maybeName?.tokenRange,
            );

            if (sectionSymbol) {
                state.result.symbols.push(sectionSymbol);
            }
            break;

        case PQP.Language.Ast.NodeKind.IdentifierPairedExpression:
            currentSymbol = InspectionUtils.getSymbolForIdentifierPairedExpression(node);
            break;

        default:
            currentSymbol = undefined;
    }

    if (currentSymbol) {
        const parentSymbol: DocumentSymbol | undefined = findParentSymbol(node.id, state);
        if (parentSymbol) {
            if (!parentSymbol.children) {
                parentSymbol.children = [];
            }

            parentSymbol.children.push(currentSymbol);
        } else {
            // Add to the top level
            state.result.symbols.push(currentSymbol);
        }

        state.parentSymbolMap.set(node.id, currentSymbol);
    }
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

function createDocumentSymbol(
    name: PQP.Language.Ast.Identifier | undefined,
    node: PQP.Language.Ast.TNode,
    selectionRange: PQP.Language.TokenRange | undefined,
): DocumentSymbol | undefined {
    if (!name) {
        return undefined;
    }

    const range: Range = LanguageServiceUtils.tokenRangeToRange(node.tokenRange);
    return {
        deprecated: false,
        kind: InspectionUtils.getSymbolKindFromNode(node),
        name: name.literal,
        range: LanguageServiceUtils.tokenRangeToRange(node.tokenRange),
        selectionRange: selectionRange ? LanguageServiceUtils.tokenRangeToRange(selectionRange) : range,
    };
}

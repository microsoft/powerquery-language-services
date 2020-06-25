// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { AnalysisOptions } from "./analysisOptions";
import { DocumentSymbol, Range, SymbolKind, TextDocument } from "./commonTypes";
import * as LanguageServiceUtils from "./languageServiceUtils";
import * as InspectionUtils from "./inspectionUtils";
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
    currentParent?: DocumentSymbol;
}

interface TraversalState extends PQP.Traverse.IState<DocumentOutline> {}

function tryTraverse(
    ast: PQP.Language.Ast.TNode,
    nodeIdMapCollection: PQP.NodeIdMap.Collection,
    options?: AnalysisOptions,
): PQP.Traverse.TriedTraverse<DocumentOutline> {
    const locale: string = options?.locale ?? DefaultLocale;
    const localizationTemplates: PQP.ILocalizationTemplates = PQP.getLocalizationTemplates(locale);

    const traversalState: TraversalState = {
        localizationTemplates,
        result: {
            symbols: [],
        },
    };

    return PQP.Traverse.tryTraverseAst(
        traversalState,
        nodeIdMapCollection,
        ast,
        PQP.Traverse.VisitNodeStrategy.DepthFirst,
        visitNode,
        PQP.Traverse.expectExpandAllAstChildren,
        undefined,
    );
}

function visitNode(state: TraversalState, node: PQP.Language.Ast.TNode): void {
    let currentSymbol: DocumentSymbol | undefined;

    switch (node.kind) {
        case PQP.Language.Ast.NodeKind.Section:
            currentSymbol = createDocumentSymbol(node.maybeName, node, node.maybeName?.tokenRange);
            break;

        default:
            currentSymbol = undefined;
    }

    if (currentSymbol) {
        if (state.result.currentParent) {
            if (!state.result.currentParent.children) {
                state.result.currentParent.children = [];
            }

            state.result.currentParent.children.push(currentSymbol);
        } else {
            // Add it to the root list of symbols
            state.result.symbols.push(currentSymbol);
        }
    }
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
        kind: InspectionUtils.getSymbolKindFromNode(node),
        name: name.literal,
        range: LanguageServiceUtils.tokenRangeToRange(node.tokenRange),
        selectionRange: selectionRange ? LanguageServiceUtils.tokenRangeToRange(selectionRange) : range,
    };
}

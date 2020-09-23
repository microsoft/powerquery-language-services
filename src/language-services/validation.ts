// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type {
    Diagnostic,
    DiagnosticRelatedInformation,
    DocumentSymbol,
    Position,
    Range,
} from "vscode-languageserver-types";
import { DiagnosticSeverity, SymbolKind } from "vscode-languageserver-types";

import { AnalysisOptions } from "./analysisOptions";
import { DiagnosticErrorCode } from "./diagnosticErrorCode";
import * as LanguageServiceUtils from "./languageServiceUtils";
import { getLocalizationTemplates } from "./localization/templates";
import * as WorkspaceCache from "./workspaceCache";

export interface ValidationResult {
    readonly diagnostics: Diagnostic[];
    readonly syntaxError: boolean;
}

export interface ValidationOptions extends AnalysisOptions {
    readonly source?: string;
    readonly checkForDuplicateIdentifiers?: boolean;
}

export function validate(document: TextDocument, options: ValidationOptions): ValidationResult {
    const cacheItem: WorkspaceCache.TParserCacheItem = WorkspaceCache.getTriedParse(document, options?.locale);
    const checked: DiagnosticCheck = diagnosticsCheck(cacheItem, options);
    const diagnostics: Diagnostic[] = checked.diagnostics;

    // TODO: Look for unknown identifiers
    if (options?.checkForDuplicateIdentifiers) {
        if (checked.maybeParserContextState !== undefined && checked.maybeParserContextState.maybeRoot !== undefined) {
            const rootNode: PQP.Parser.TXorNode = PQP.Parser.XorNodeUtils.contextFactory(
                checked.maybeParserContextState.maybeRoot,
            );
            const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection =
                checked.maybeParserContextState.nodeIdMapCollection;
            const triedTraverse: PQP.Traverse.TriedTraverse<Diagnostic[]> = tryTraverse(
                document.uri,
                rootNode,
                nodeIdMapCollection,
                options,
            );

            // TODO: Trace error case
            if (PQP.ResultUtils.isOk(triedTraverse)) {
                diagnostics.push(...triedTraverse.value);
            }
        }
    }

    if (!options?.maintainWorkspaceCache) {
        WorkspaceCache.close(document);
    }

    return {
        // TODO: figure out why TypeScript isn't allowing PQP.ResultUtils.isErr(cacheItem)
        syntaxError: cacheItem.kind === PQP.ResultKind.Err,
        diagnostics,
    };
}

interface DiagnosticCheck {
    readonly diagnostics: Diagnostic[];
    readonly maybeParserContextState: PQP.Parser.ParseContext.State | undefined;
}

const EmptyDiagnosticCheck: DiagnosticCheck = {
    diagnostics: [],
    maybeParserContextState: undefined,
};

function diagnosticsCheck(
    parserCacheItem: WorkspaceCache.TParserCacheItem,
    options: ValidationOptions,
): DiagnosticCheck {
    switch (parserCacheItem.stage) {
        case WorkspaceCache.CacheStageKind.Lexer:
            return lexerDiagnosticCheck(parserCacheItem, options);

        case WorkspaceCache.CacheStageKind.LexerSnapshot:
            return EmptyDiagnosticCheck;

        case WorkspaceCache.CacheStageKind.Parser:
            return parserDiagnosticCheck(parserCacheItem, options);

        default:
            throw PQP.Assert.isNever(parserCacheItem);
    }
}

function lexerDiagnosticCheck(triedLex: PQP.Lexer.TriedLex, options: ValidationOptions): DiagnosticCheck {
    if (PQP.ResultUtils.isOk(triedLex)) {
        return EmptyDiagnosticCheck;
    } else if (!PQP.Lexer.LexError.isLexError(triedLex.error)) {
        return EmptyDiagnosticCheck;
    }

    const error: PQP.Lexer.LexError.LexError = triedLex.error;
    const diagnostics: Diagnostic[] = [];
    // TODO: handle other types of lexer errors
    if (error instanceof PQP.Lexer.LexError.ErrorLineMapError) {
        for (const errorLine of error.errorLineMap.values()) {
            const innerError: PQP.Lexer.LexError.TInnerLexError = errorLine.error.innerError;
            if ((innerError as any).graphemePosition) {
                const graphemePosition: PQP.StringUtils.GraphemePosition = (innerError as any).graphemePosition;
                const message: string = innerError.message;
                const position: Position = {
                    line: graphemePosition.lineNumber,
                    character: graphemePosition.lineCodeUnit,
                };
                // TODO: "lex" errors aren't that useful to display to end user. Should we make it more generic?
                diagnostics.push({
                    code: DiagnosticErrorCode.LexError,
                    message,
                    severity: DiagnosticSeverity.Error,
                    source: options?.source,
                    range: {
                        start: position,
                        end: position,
                    },
                });
            }
        }
    }

    return {
        diagnostics: diagnostics.length !== 0 ? diagnostics : diagnostics,
        maybeParserContextState: undefined,
    };
}

function parserDiagnosticCheck(triedParse: PQP.Parser.TriedParse, options: ValidationOptions): DiagnosticCheck {
    if (PQP.ResultUtils.isOk(triedParse)) {
        return {
            diagnostics: [],
            maybeParserContextState: triedParse.value.state.contextState,
        };
    } else if (!PQP.Parser.ParseError.isParseError(triedParse.error)) {
        return EmptyDiagnosticCheck;
    }

    const error: PQP.Parser.ParseError.ParseError = triedParse.error as PQP.Parser.ParseError.ParseError;
    const innerError: PQP.Parser.ParseError.TInnerParseError = error.innerError;
    const message: string = error.message;
    const parseContextState: PQP.Parser.ParseContext.State = error.state.contextState;

    let maybeErrorToken: PQP.Language.Token.Token | undefined;
    if (
        (innerError instanceof PQP.Parser.ParseError.ExpectedAnyTokenKindError ||
            innerError instanceof PQP.Parser.ParseError.ExpectedTokenKindError) &&
        innerError.maybeFoundToken !== undefined
    ) {
        maybeErrorToken = innerError.maybeFoundToken.token;
    } else if (innerError instanceof PQP.Parser.ParseError.InvalidPrimitiveTypeError) {
        maybeErrorToken = innerError.token;
    } else if (innerError instanceof PQP.Parser.ParseError.UnterminatedBracketError) {
        maybeErrorToken = innerError.openBracketToken;
    } else if (innerError instanceof PQP.Parser.ParseError.UnterminatedParenthesesError) {
        maybeErrorToken = innerError.openParenthesesToken;
    } else if (innerError instanceof PQP.Parser.ParseError.UnusedTokensRemainError) {
        maybeErrorToken = innerError.firstUnusedToken;
    } else {
        maybeErrorToken = undefined;
    }

    let range: Range;
    if (maybeErrorToken !== undefined) {
        range = {
            start: {
                line: maybeErrorToken.positionStart.lineNumber,
                character: maybeErrorToken.positionStart.lineCodeUnit,
            },
            end: {
                line: maybeErrorToken.positionEnd.lineNumber,
                character: maybeErrorToken.positionEnd.lineCodeUnit,
            },
        };
    } else {
        const maybeRoot: PQP.Parser.ParseContext.Node | undefined = parseContextState.maybeRoot;
        if (maybeRoot === undefined) {
            return EmptyDiagnosticCheck;
        }

        const maybeLeaf: PQP.Language.Ast.TNode | undefined = PQP.Parser.NodeIdMapUtils.maybeRightMostLeaf(
            error.state.contextState.nodeIdMapCollection,
            maybeRoot.id,
        );
        if (maybeLeaf === undefined) {
            return EmptyDiagnosticCheck;
        }
        const leafTokenRange: PQP.Language.Token.TokenRange = maybeLeaf.tokenRange;

        range = {
            start: {
                line: leafTokenRange.positionStart.lineNumber,
                character: leafTokenRange.positionStart.lineCodeUnit,
            },
            end: {
                line: leafTokenRange.positionEnd.lineNumber,
                character: leafTokenRange.positionEnd.lineCodeUnit,
            },
        };
    }

    return {
        diagnostics: [
            {
                code: DiagnosticErrorCode.ParseError,
                message,
                range,
                severity: DiagnosticSeverity.Error,
                source: options?.source,
            },
        ],
        maybeParserContextState: parseContextState,
    };
}

interface TraversalState extends PQP.Traverse.IState<Diagnostic[]> {
    readonly documentUri: string;
    readonly nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection;
    readonly options: ValidationOptions;
    readonly source?: string;
}

function tryTraverse(
    documentUri: string,
    root: PQP.Parser.TXorNode,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    options: ValidationOptions,
): PQP.Traverse.TriedTraverse<Diagnostic[]> {
    const locale: string = LanguageServiceUtils.getLocale(options);
    const localizationTemplates: PQP.ILocalizationTemplates = PQP.getLocalizationTemplates(locale);

    const traversalState: TraversalState = {
        documentUri,
        localizationTemplates,
        nodeIdMapCollection,
        result: [],
        source: options?.source,
        options,
    };

    return PQP.Traverse.tryTraverseXor(
        traversalState,
        nodeIdMapCollection,
        root,
        PQP.Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        PQP.Traverse.assertGetAllXorChildren,
        undefined,
    );
}

function keyValuePairsToSymbols(
    keyValuePairs: ReadonlyArray<
        PQP.Parser.NodeIdMapIterator.KeyValuePair<PQP.Language.Ast.GeneralizedIdentifier | PQP.Language.Ast.Identifier>
    >,
): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];
    for (const value of keyValuePairs) {
        const range: Range = LanguageServiceUtils.tokenRangeToRange(value.key.tokenRange);
        symbols.push({
            kind: SymbolKind.Variable,
            name: value.keyLiteral,
            range,
            selectionRange: range,
        });
    }

    return symbols;
}

function visitNode(state: TraversalState, currentXorNode: PQP.Parser.TXorNode): void {
    let symbols: DocumentSymbol[] | undefined = undefined;

    // TODO: Validate that "in" variable exists
    switch (currentXorNode.node.kind) {
        case PQP.Language.Ast.NodeKind.LetExpression:
            const letMembers: ReadonlyArray<PQP.Parser.NodeIdMapIterator.KeyValuePair<
                PQP.Language.Ast.Identifier
            >> = PQP.Parser.NodeIdMapIterator.iterLetExpression(state.nodeIdMapCollection, currentXorNode);
            if (letMembers.length > 1) {
                symbols = keyValuePairsToSymbols(letMembers);
            }
            break;

        case PQP.Language.Ast.NodeKind.RecordExpression:
        case PQP.Language.Ast.NodeKind.RecordLiteral:
            const recordFields: ReadonlyArray<PQP.Parser.NodeIdMapIterator.KeyValuePair<
                PQP.Language.Ast.GeneralizedIdentifier
            >> = PQP.Parser.NodeIdMapIterator.iterRecord(state.nodeIdMapCollection, currentXorNode);
            if (recordFields.length > 1) {
                symbols = keyValuePairsToSymbols(recordFields);
            }
            break;

        case PQP.Language.Ast.NodeKind.Section:
            const sectionMembers: ReadonlyArray<PQP.Parser.NodeIdMapIterator.KeyValuePair<
                PQP.Language.Ast.Identifier
            >> = PQP.Parser.NodeIdMapIterator.iterSection(state.nodeIdMapCollection, currentXorNode);
            if (sectionMembers.length > 1) {
                symbols = keyValuePairsToSymbols(sectionMembers);
            }
            break;

        default:
    }

    if (symbols) {
        // Look for duplicate member/variable/field names
        state.result.push(...identifyDuplicateSymbols(state, symbols));
    }
}

function identifyDuplicateSymbols(state: TraversalState, symbols: DocumentSymbol[]): Diagnostic[] {
    const result: Diagnostic[] = [];
    const seenSymbols: Map<string, DocumentSymbol[]> = new Map<string, DocumentSymbol[]>();

    for (const symbol of symbols) {
        const symbolsForName: DocumentSymbol[] | undefined = seenSymbols.get(symbol.name);
        if (symbolsForName) {
            symbolsForName.push(symbol);
        } else {
            seenSymbols.set(symbol.name, [symbol]);
        }
    }

    for (const symbolArray of seenSymbols.values()) {
        if (symbolArray.length > 1) {
            // Create related information diagnostic for each duplicate
            const relatedInfo: DiagnosticRelatedInformation[] = [];
            for (const value of symbolArray) {
                relatedInfo.push({
                    location: {
                        range: value.range,
                        uri: state.documentUri,
                    },
                    message: duplicateSymbolMessage(value.name, state.options),
                });
            }

            // Create separate diagnostics for each symbol after the first
            for (let i: number = 1; i < symbolArray.length; i++) {
                // Filtered related info to exclude the current symbol
                const filteredRelatedInfo: DiagnosticRelatedInformation[] = relatedInfo.filter(
                    (_v, index) => index !== i,
                );

                result.push({
                    code: DiagnosticErrorCode.DuplicateIdentifier,
                    message: duplicateSymbolMessage(symbolArray[i].name, state.options),
                    range: symbolArray[i].range,
                    relatedInformation: filteredRelatedInfo,
                    severity: DiagnosticSeverity.Error,
                    source: state.source,
                });
            }
        }
    }

    return result;
}

function duplicateSymbolMessage(identifier: string, options: ValidationOptions): string {
    const locale: string = options?.locale ?? PQP.DefaultLocale;
    const template: string = getLocalizationTemplates(locale).error_validation_duplicate_identifier;
    return PQP.StringUtils.assertGetFormatted(template, new Map([["identifier", identifier]]));
}

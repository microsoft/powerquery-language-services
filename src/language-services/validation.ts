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
import { DiagnosticSeverity } from "vscode-languageserver-types";

import { AnalysisOptions } from "./analysisOptions";
import { DiagnosticErrorCode } from "./diagnosticErrorCode";
import * as InspectionUtils from "./inspectionUtils";
import * as LanguageServiceUtils from "./languageServiceUtils";
import * as WorkspaceCache from "./workspaceCache";

export interface ValidationResult {
    readonly diagnostics: Diagnostic[];
    readonly syntaxError: boolean;
}

export interface ValidationOptions extends AnalysisOptions {
    readonly source?: string;
}

export function validate(document: TextDocument, options?: ValidationOptions): ValidationResult {
    const triedLexParse: PQP.Task.TriedLexParse = WorkspaceCache.getTriedLexParse(document);
    let diagnostics: Diagnostic[] = [];

    let contextState: PQP.ParseContext.State | undefined = undefined;

    // Check for syntax errors
    if (PQP.ResultUtils.isErr(triedLexParse)) {
        const lexOrParseError: PQP.LexError.TLexError | PQP.ParseError.TParseError = triedLexParse.error;
        if (lexOrParseError instanceof PQP.ParseError.ParseError) {
            contextState = lexOrParseError.state.contextState;
            const maybeDiagnostic: Diagnostic | undefined = maybeParseErrorToDiagnostic(
                lexOrParseError,
                options?.source,
            );
            if (maybeDiagnostic !== undefined) {
                diagnostics = [maybeDiagnostic];
            }
        } else if (PQP.LexError.isTInnerLexError(lexOrParseError.innerError)) {
            const maybeLexerErrorDiagnostics: Diagnostic[] | undefined = maybeLexErrorToDiagnostics(
                lexOrParseError.innerError,
                options?.source,
            );
            if (maybeLexerErrorDiagnostics !== undefined) {
                diagnostics = maybeLexerErrorDiagnostics;
            }
        }
    } else {
        contextState = triedLexParse.value.state.contextState;
    }

    // TODO: Check for unknown identifiers
    if (contextState && contextState.root.maybeNode) {
        const rootNode: PQP.TXorNode = PQP.NodeIdMapUtils.xorNodeFromContext(contextState.root.maybeNode);
        const nodeIdMapCollection: PQP.NodeIdMap.Collection = contextState.nodeIdMapCollection;
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

    if (!options?.maintainWorkspaceCache) {
        WorkspaceCache.close(document);
    }

    return {
        syntaxError: PQP.ResultUtils.isErr(triedLexParse),
        diagnostics,
    };
}

function maybeLexErrorToDiagnostics(error: PQP.LexError.TInnerLexError, source?: string): Diagnostic[] | undefined {
    const diagnostics: Diagnostic[] = [];
    // TODO: handle other types of lexer errors
    if (error instanceof PQP.LexError.ErrorLineMapError) {
        for (const errorLine of error.errorLineMap.values()) {
            const innerError: PQP.LexError.TInnerLexError = errorLine.error.innerError;
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
                    source,
                    range: {
                        start: position,
                        end: position,
                    },
                });
            }
        }
    }
    return diagnostics.length ? diagnostics : undefined;
}

function maybeParseErrorToDiagnostic(error: PQP.ParseError.ParseError, source?: string): Diagnostic | undefined {
    const innerError: PQP.ParseError.TInnerParseError = error.innerError;
    const message: string = error.message;
    let maybeErrorToken: PQP.Language.Token | undefined;
    if (
        (innerError instanceof PQP.ParseError.ExpectedAnyTokenKindError ||
            innerError instanceof PQP.ParseError.ExpectedTokenKindError) &&
        innerError.maybeFoundToken !== undefined
    ) {
        maybeErrorToken = innerError.maybeFoundToken.token;
    } else if (innerError instanceof PQP.ParseError.InvalidPrimitiveTypeError) {
        maybeErrorToken = innerError.token;
    } else if (innerError instanceof PQP.ParseError.UnterminatedBracketError) {
        maybeErrorToken = innerError.openBracketToken;
    } else if (innerError instanceof PQP.ParseError.UnterminatedParenthesesError) {
        maybeErrorToken = innerError.openParenthesesToken;
    } else if (innerError instanceof PQP.ParseError.UnusedTokensRemainError) {
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
        const parseContextState: PQP.ParseContext.State = error.state.contextState;
        const maybeRoot: PQP.ParseContext.Node | undefined = parseContextState.root.maybeNode;
        if (maybeRoot === undefined) {
            return undefined;
        }

        const maybeLeaf: PQP.Language.Ast.TNode | undefined = PQP.NodeIdMapUtils.maybeRightMostLeaf(
            error.state.contextState.nodeIdMapCollection,
            maybeRoot.id,
        );
        if (maybeLeaf === undefined) {
            return undefined;
        }
        const leafTokenRange: PQP.Language.TokenRange = maybeLeaf.tokenRange;

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
        code: DiagnosticErrorCode.ParserError,
        message,
        range,
        severity: DiagnosticSeverity.Error,
        source,
    };
}

interface TraversalState extends PQP.Traverse.IState<Diagnostic[]> {
    readonly documentUri: string;
    readonly source?: string;
}

function tryTraverse(
    documentUri: string,
    root: PQP.TXorNode,
    nodeIdMapCollection: PQP.NodeIdMap.Collection,
    options?: ValidationOptions,
): PQP.Traverse.TriedTraverse<Diagnostic[]> {
    const locale: string = LanguageServiceUtils.getLocale(options);
    const localizationTemplates: PQP.ILocalizationTemplates = PQP.getLocalizationTemplates(locale);

    const traversalState: TraversalState = {
        documentUri,
        localizationTemplates,
        result: [],
        source: options?.source,
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
        currentXorNode.node.kind === PQP.Language.Ast.NodeKind.MetadataExpression
    );
}

function visitNode(state: TraversalState, currentXorNode: PQP.TXorNode): void {
    if (currentXorNode.kind === PQP.XorNodeKind.Context) {
        return;
    }

    let symbols: DocumentSymbol[] | undefined = undefined;

    switch (currentXorNode.node.kind) {
        case PQP.Language.Ast.NodeKind.LetExpression:
            // TODO: Validate that "in" variable exists
            symbols = InspectionUtils.getSymbolsForLetExpression(currentXorNode.node);
            break;

        case PQP.Language.Ast.NodeKind.RecordExpression:
        case PQP.Language.Ast.NodeKind.RecordLiteral:
            symbols = InspectionUtils.getSymbolsForRecord(currentXorNode.node);
            break;

        case PQP.Language.Ast.NodeKind.Section:
            symbols = InspectionUtils.getSymbolsForSection(currentXorNode.node);
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

    symbols.forEach(symbol => {
        if (seenSymbols.has(symbol.name)) {
            seenSymbols.get(symbol.name)?.push(symbol);
        } else {
            seenSymbols.set(symbol.name, [symbol]);
        }
    });

    seenSymbols.forEach(symbolArray => {
        if (symbolArray.length > 0) {
            const duplicateSymbols: DocumentSymbol[] = symbolArray.slice(1);
            const relatedInfo: DiagnosticRelatedInformation[] = [];
            duplicateSymbols.forEach(value => {
                relatedInfo.push({
                    location: {
                        range: value.range,
                        uri: state.documentUri,
                    },
                    // TODO: localization support
                    message: `Duplicate identifier '${value.name}'`,
                });
            });

            result.push({
                code: DiagnosticErrorCode.DuplicateIdentifier,
                // TODO: localization support
                message: `Duplicate identifier '${symbolArray[0].name}'`,
                range: symbolArray[0].range,
                severity: DiagnosticSeverity.Error,
                source: state.source,
            });
        }
    });

    return result;
}

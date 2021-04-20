// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Diagnostic, Position, Range } from "vscode-languageserver-types";
import { DiagnosticSeverity } from "vscode-languageserver-types";

import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { ValidationOptions } from "./commonTypes";

export interface LexParseDiagnosticCheck {
    readonly diagnostics: Diagnostic[];
    readonly maybeParserContextState: PQP.Parser.ParseContext.State | undefined;
}

export function validateLexAndParse(document: TextDocument, options: ValidationOptions): LexParseDiagnosticCheck {
    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, options?.locale);
    return createLexParseDiagnosticCheck(cacheItem, options);
}

const EmptyDiagnosticCheck: LexParseDiagnosticCheck = {
    diagnostics: [],
    maybeParserContextState: undefined,
};

function createLexParseDiagnosticCheck(
    parserCacheItem: WorkspaceCache.ParseCacheItem,
    options: ValidationOptions,
): LexParseDiagnosticCheck {
    switch (parserCacheItem.stage) {
        case PQP.Task.TaskStage.Lex:
            return lexerDiagnosticCheck(parserCacheItem, options);

        case PQP.Task.TaskStage.Parse:
            return parserDiagnosticCheck(parserCacheItem, options);

        default:
            throw PQP.Assert.isNever(parserCacheItem);
    }
}

function lexerDiagnosticCheck(triedLex: PQP.Task.TriedLexTask, options: ValidationOptions): LexParseDiagnosticCheck {
    if (PQP.TaskUtils.isOk(triedLex)) {
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

function parserDiagnosticCheck(
    triedParse: PQP.Task.TriedParseTask,
    options: ValidationOptions,
): LexParseDiagnosticCheck {
    if (PQP.TaskUtils.isOk(triedParse)) {
        return {
            diagnostics: [],
            maybeParserContextState: triedParse.parseState.contextState,
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
    } else if (innerError instanceof PQP.Parser.ParseError.UnterminatedSequence) {
        maybeErrorToken = innerError.startToken;
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

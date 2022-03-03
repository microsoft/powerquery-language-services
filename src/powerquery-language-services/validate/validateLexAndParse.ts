// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Diagnostic, DiagnosticSeverity, Position, Range } from "vscode-languageserver-types";
import { NodeIdMapUtils, ParseContext } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { ValidationSettings } from "./validationSettings";
import { WorkspaceCacheUtils } from "../workspaceCache";

export async function validateLexAndParse(
    textDocument: TextDocument,
    validationSettings: ValidationSettings,
): Promise<Diagnostic[]> {
    const parsePromise: PQP.Task.TriedParseTask | undefined = await WorkspaceCacheUtils.getOrCreateParsePromise(
        textDocument,
        validationSettings,
    );

    if (parsePromise !== undefined) {
        return validateParse(parsePromise, validationSettings);
    }

    const lexPromise: PQP.Task.TriedLexTask | undefined = await WorkspaceCacheUtils.getOrCreateLexPromise(
        textDocument,
        validationSettings,
    );

    if (lexPromise !== undefined) {
        return validateLex(lexPromise, validationSettings);
    }

    return [];
}

function validateLex(triedLex: PQP.Task.TriedLexTask, validationSettings: ValidationSettings): Diagnostic[] {
    if (PQP.TaskUtils.isOk(triedLex) || !PQP.Lexer.LexError.isLexError(triedLex.error)) {
        return [];
    }

    const error: PQP.Lexer.LexError.LexError = triedLex.error;
    const diagnostics: Diagnostic[] = [];

    // TODO: handle other types of lexer errors
    if (error instanceof PQP.Lexer.LexError.ErrorLineMapError) {
        for (const errorLine of error.errorLineMap.values()) {
            const innerError: PQP.Lexer.LexError.TInnerLexError = errorLine.error.innerError;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((innerError as any).graphemePosition) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    source: validationSettings?.source,
                    range: {
                        start: position,
                        end: position,
                    },
                });
            }
        }
    }

    return diagnostics;
}

async function validateParse(
    triedParse: PQP.Task.TriedParseTask,
    validationSettings: ValidationSettings,
): Promise<Diagnostic[]> {
    if (PQP.TaskUtils.isOk(triedParse) || !PQP.Parser.ParseError.isParseError(triedParse.error)) {
        return [];
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
        const maybeRoot: ParseContext.TNode | undefined = parseContextState.maybeRoot;

        if (maybeRoot === undefined) {
            return [];
        }

        // TODO: figure out why this exception is needed
        // eslint-disable-next-line @typescript-eslint/await-thenable
        const maybeLeaf: Ast.TNode | undefined = await NodeIdMapUtils.maybeRightMostLeaf(
            error.state.contextState.nodeIdMapCollection,
            maybeRoot.id,
        );

        if (maybeLeaf === undefined) {
            return [];
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

    return [
        {
            code: DiagnosticErrorCode.ParseError,
            message,
            range,
            severity: DiagnosticSeverity.Error,
            source: validationSettings?.source,
        },
    ];
}

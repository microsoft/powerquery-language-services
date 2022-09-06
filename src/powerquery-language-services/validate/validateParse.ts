// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver-types";
import { NodeIdMapUtils, ParseContext, ParseError } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { ValidationSettings } from "./validationSettings";

export async function validateParse(
    maybeParseError: ParseError.ParseError | undefined,
    validationSettings: ValidationSettings,
): Promise<Diagnostic[]> {
    if (maybeParseError === undefined || !ParseError.isParseError(maybeParseError)) {
        return [];
    }

    const innerError: ParseError.TInnerParseError = maybeParseError.innerError;
    const maybeErrorToken: PQP.Language.Token.Token | undefined = PQP.Parser.ParseError.tokenFrom(innerError);
    const message: string = maybeParseError.message;
    const parseContextState: PQP.Parser.ParseContext.State = maybeParseError.state.contextState;

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
        const maybeRoot: ParseContext.TNode | undefined = parseContextState.root;

        if (maybeRoot === undefined) {
            return [];
        }

        const maybeLeaf: Ast.TNode | undefined = await NodeIdMapUtils.rightMostLeaf(
            maybeParseError.state.contextState.nodeIdMapCollection,
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

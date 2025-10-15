// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { type Diagnostic, DiagnosticSeverity, type Range } from "vscode-languageserver-types";
import {
    NodeIdMapUtils,
    type ParseContext,
    ParseError,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { type Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { type ValidationSettings } from "./validationSettings";

export async function validateParse(
    parseError: ParseError.ParseError | undefined,
    validationSettings: ValidationSettings,
): Promise<Diagnostic[]> {
    if (parseError === undefined || !ParseError.isParseError(parseError)) {
        return [];
    }

    const innerError: ParseError.TInnerParseError = parseError.innerError;
    const errorToken: PQP.Language.Token.Token | undefined = PQP.Parser.ParseError.tokenFrom(innerError);
    const message: string = parseError.message;
    const parseContextState: PQP.Parser.ParseContext.State = parseError.state.contextState;

    let range: Range;

    if (errorToken !== undefined) {
        range = {
            start: {
                line: errorToken.positionStart.lineNumber,
                character: errorToken.positionStart.lineCodeUnit,
            },
            end: {
                line: errorToken.positionEnd.lineNumber,
                character: errorToken.positionEnd.lineCodeUnit,
            },
        };
    } else {
        const root: ParseContext.TNode | undefined = parseContextState.root;

        if (root === undefined) {
            return [];
        }

        const leaf: Ast.TNode | undefined = await NodeIdMapUtils.rightMostLeaf(
            parseError.state.contextState.nodeIdMapCollection,
            root.id,
        );

        if (leaf === undefined) {
            return [];
        }

        const leafTokenRange: PQP.Language.Token.TokenRange = leaf.tokenRange;

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

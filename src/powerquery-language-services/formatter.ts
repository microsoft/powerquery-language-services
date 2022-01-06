// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQF from "@microsoft/powerquery-formatter";
import * as PQP from "@microsoft/powerquery-parser";
import { FormattingOptions, Range, TextEdit } from "vscode-languageserver-types";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { TextDocument } from "vscode-languageserver-textdocument";

export function tryFormat(document: TextDocument, formattingOptions: FormattingOptions, locale: string): TextEdit[] {
    let indentationLiteral: PQF.IndentationLiteral;

    if (formattingOptions.insertSpaces) {
        indentationLiteral = PQF.IndentationLiteral.SpaceX4;
    } else {
        indentationLiteral = PQF.IndentationLiteral.Tab;
    }

    const formatSettings: PQF.FormatSettings = {
        ...PQF.DefaultSettings,
        locale,
        indentationLiteral,
    };

    const triedFormat: PQF.TriedFormat = PQF.tryFormat(formatSettings, document.getText());

    if (ResultUtils.isOk(triedFormat)) {
        return [TextEdit.replace(fullDocumentRange(document), triedFormat.value)];
    }
    // If an unhandled exception was returned.
    else if (PQP.CommonError.isCommonError(triedFormat.error)) {
        throw triedFormat.error;
    }
    // Else a lexer or parser error was returned and should be ignored.
    else {
        return [];
    }
}

// TODO: is there a better way to do this?
function fullDocumentRange(document: TextDocument): Range {
    return {
        start: document.positionAt(0),
        end: {
            line: document.lineCount - 1,
            character: Number.MAX_VALUE,
        },
    };
}

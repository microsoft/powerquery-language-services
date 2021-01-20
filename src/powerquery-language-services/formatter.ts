// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQF from "@microsoft/powerquery-formatter";
import * as PQP from "@microsoft/powerquery-parser";

import { TextDocument } from "vscode-languageserver-textdocument";
import { FormattingOptions, Range, TextEdit } from "vscode-languageserver-types";

export function tryFormat(
    document: TextDocument,
    formattingOptions: FormattingOptions,
    locale: string,
): ReadonlyArray<TextEdit> {
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

    if (PQP.ResultUtils.isOk(triedFormat)) {
        return [TextEdit.replace(fullDocumentRange(document), triedFormat.value)];
    } else {
        const message: string | undefined = PQF.FormatError.isTFormatError(triedFormat.error)
            ? triedFormat.error.innerError.message
            : undefined;

        throw new Error(message);
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

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQF from "@microsoft/powerquery-formatter";
import * as PQP from "@microsoft/powerquery-parser";

import { FormattingOptions, Range, TextDocument, TextEdit } from "vscode-languageserver-types";

export function tryFormat(
    document: TextDocument,
    formattingOptions: FormattingOptions,
    localizationTemplates: PQP.ILocalizationTemplates,
): PQP.Result<TextEdit[], string> {
    let indentationLiteral: PQF.IndentationLiteral;
    if (formattingOptions.insertSpaces) {
        indentationLiteral = PQF.IndentationLiteral.SpaceX4;
    } else {
        indentationLiteral = PQF.IndentationLiteral.Tab;
    }

    const pqfFormatSettings: PQF.FormatSettings = {
        ...PQP.DefaultSettings,
        localizationTemplates,
        indentationLiteral,
        newlineLiteral: PQF.NewlineLiteral.Windows,
    };
    const triedFormat: PQF.TriedFormat = PQF.tryFormat(pqfFormatSettings, document.getText());

    if (PQP.ResultUtils.isOk(triedFormat)) {
        return PQP.ResultUtils.okFactory([TextEdit.replace(fullDocumentRange(document), triedFormat.value)]);
    } else {
        let message: string;
        if (PQF.FormatError.isTFormatError(triedFormat.error)) {
            message = triedFormat.error.innerError.message;
        } else {
            message = "An unknown error occured during formatting.";
        }

        return PQP.ResultUtils.errFactory(message);
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

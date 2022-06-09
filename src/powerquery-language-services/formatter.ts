// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQF from "@microsoft/powerquery-formatter";
import * as PQP from "@microsoft/powerquery-parser";
import { Range, TextEdit } from "vscode-languageserver-types";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { TextDocument } from "vscode-languageserver-textdocument";

export async function tryFormat(
    document: TextDocument,
    settings: PQF.FormatSettings,
    experimental: boolean,
): Promise<TextEdit[]> {
    const formatSettings: PQF.FormatSettings = {
        ...PQF.DefaultSettings,
        ...settings,
    };

    const triedFormat: PQF.TriedFormat = experimental
        ? await PQF.tryFormatV2(formatSettings, document.getText())
        : await PQF.tryFormat(formatSettings, document.getText());

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

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQF from "@microsoft/powerquery-formatter";
import * as PQP from "@microsoft/powerquery-parser";
import { type Range, TextEdit } from "vscode-languageserver-types";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { type TextDocument } from "vscode-languageserver-textdocument";

export function tryFormat(
    document: TextDocument,
    settings: PQF.FormatSettings,
): Promise<PQP.Result<TextEdit[] | undefined, PQP.CommonError.CommonError>> {
    return ResultUtils.ensureResultAsync(async () => {
        const formatSettings: PQF.FormatSettings = {
            ...PQF.DefaultSettings,
            ...settings,
        };

        const triedFormat: PQF.TriedFormat = await PQF.tryFormat(formatSettings, document.getText());

        if (ResultUtils.isOk(triedFormat)) {
            return [TextEdit.replace(fullDocumentRange(document), triedFormat.value)];
        }
        // If an unhandled exception was returned.
        else if (PQP.CommonError.isCommonError(triedFormat.error)) {
            throw triedFormat;
        }
        // Else a lexer or parser error was returned and should be ignored.
        else {
            return undefined;
        }
    }, settings.locale);
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

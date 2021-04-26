// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { TextDocument } from "vscode-languageserver-textdocument";

import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateLexAndParse } from "./validateLexAndParse";
import type { ValidationResult } from "./validationResult";
import type { ValidationSettings } from "./validationSettings";

export function validate<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    textDocument: TextDocument,
    validationSettings: ValidationSettings<S>,
): ValidationResult {
    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getOrCreateParse(
        textDocument,
        validationSettings,
    );

    return {
        diagnostics: [
            ...validateDuplicateIdentifiers(textDocument, validationSettings),
            ...validateLexAndParse(textDocument, validationSettings),
        ],
        hasSyntaxError: PQP.TaskUtils.isLexStageError(cacheItem) || PQP.TaskUtils.isParseStageError(cacheItem),
    };
}

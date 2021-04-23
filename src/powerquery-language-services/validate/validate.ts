// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { TextDocument } from "vscode-languageserver-textdocument";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";

import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateLexAndParse } from "./validateLexAndParse";
import type { ValidationResult } from "./validationResult";
import type { ValidationSettings } from "./validationSettings";

export function validate<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    document: TextDocument,
    validationSettings: ValidationSettings<S>,
): ValidationResult {
    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(
        document,
        validationSettings?.locale,
    );

    return {
        diagnostics: [
            ...validateDuplicateIdentifiers(document, validationSettings),
            ...validateLexAndParse(document, validationSettings),
        ],
        hasSyntaxError: PQP.TaskUtils.isLexStageError(cacheItem) || PQP.TaskUtils.isParseStageError(cacheItem),
    };
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { TextDocument } from "vscode-languageserver-textdocument";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";

import { ValidationOptions, ValidationResult } from "./commonTypes";
import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateLexAndParse } from "./validateLexAndParse";

export function validate(document: TextDocument, options: ValidationOptions): ValidationResult {
    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, options?.locale);

    return {
        diagnostics: [...validateDuplicateIdentifiers(document, options), ...validateLexAndParse(document, options)],
        isSyntaxError: PQP.TaskUtils.isLexStageError(cacheItem) || PQP.TaskUtils.isParseStageError(cacheItem),
    };
}

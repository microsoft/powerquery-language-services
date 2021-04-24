// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { WorkspaceCacheSettings } from "../workspaceCache/workspaceCache";

import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateLexAndParse } from "./validateLexAndParse";
import type { ValidationResult } from "./validationResult";
import type { ValidationSettings } from "./validationSettings";

export function validate<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    workspaceCacheSettings: WorkspaceCacheSettings,
    validationSettings: ValidationSettings<S>,
): ValidationResult {
    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getOrCreateParse(
        workspaceCacheSettings,
        validationSettings,
    );

    return {
        diagnostics: [
            ...validateDuplicateIdentifiers(workspaceCacheSettings, validationSettings),
            ...validateLexAndParse(workspaceCacheSettings, validationSettings),
        ],
        hasSyntaxError: PQP.TaskUtils.isLexStageError(cacheItem) || PQP.TaskUtils.isParseStageError(cacheItem),
    };
}

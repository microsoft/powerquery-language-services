// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { Diagnostic, DiagnosticRelatedInformation, DocumentUri } from "vscode-languageserver-types";
import { DiagnosticSeverity } from "vscode-languageserver-types";

import * as LanguageServiceUtils from "../languageServiceUtils";

import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { Localization, LocalizationUtils } from "../localization";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { ValidationSettings } from "./validationSettings";

export function validateInvokeExpression(nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection): Diagnostic[] {}

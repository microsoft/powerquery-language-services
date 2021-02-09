// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItemProvider, ISymbolProvider } from "../providers/commonTypes";

export interface AnalysisOptions {
    readonly libraryCompletionItemProvider?: CompletionItemProvider;
    readonly localDocumentSymbolProvider?: ISymbolProvider;
    readonly locale?: string;
    readonly maintainWorkspaceCache?: boolean;
}

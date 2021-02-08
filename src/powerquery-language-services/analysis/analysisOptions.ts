// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LibraryProvider, SymbolProvider } from "../providers/commonTypes";

export interface AnalysisOptions {
    readonly locale?: string;
    readonly environmentSymbolProvider?: SymbolProvider;
    readonly libraryProvider?: LibraryProvider;
    readonly maintainWorkspaceCache?: boolean;
}

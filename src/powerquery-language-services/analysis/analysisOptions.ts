// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { LibrarySymbolProvider, SymbolProvider } from "../providers/commonTypes";

export interface AnalysisOptions {
    readonly locale?: string;
    readonly environmentSymbolProvider?: SymbolProvider;
    readonly librarySymbolProvider?: LibrarySymbolProvider;
    readonly maintainWorkspaceCache?: boolean;
    readonly typeResolverFn?: PQP.Language.ExternalType.TExternalTypeResolverFn;
}

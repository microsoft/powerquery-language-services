// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { LibraryProvider, SymbolProvider } from "../providers/commonTypes";

export interface AnalysisOptions {
    readonly locale?: string;
    readonly environmentSymbolProvider?: SymbolProvider;
    readonly libraryProvider?: LibraryProvider;
    readonly maintainWorkspaceCache?: boolean;
    readonly typeResolverFn?: PQP.Language.ExternalType.TExternalTypeResolverFn;
}

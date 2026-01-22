// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { type IAutocompleteItemProvider, type ILibraryProvider, type ILocalDocumentProvider } from "../providers";
import { type ILibrary } from "../library/library";
import { type InspectionSettings } from "../inspectionSettings";
import { type TypeCache } from "../inspection";

export interface AnalysisSettings {
    // Allows injection of custom providers.
    readonly languageAutocompleteItemProviderFactory?: (locale: string) => IAutocompleteItemProvider;
    readonly libraryProviderFactory?: (library: ILibrary, locale: string) => ILibraryProvider;
    readonly localDocumentProviderFactory?: (
        uri: string,
        typeCache: TypeCache,
        library: ILibrary,
        locale: string,
    ) => ILocalDocumentProvider;
    readonly inspectionSettings: InspectionSettings;
    readonly isWorkspaceCacheAllowed: boolean;
    readonly initialCorrelationId: number | undefined;
    readonly traceManager: TraceManager;
}

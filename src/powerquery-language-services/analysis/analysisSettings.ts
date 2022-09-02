// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { IAutocompleteItemProvider, ILibraryProvider, ILocalDocumentProvider } from "../providers";
import { ILibrary } from "../library/library";
import { InspectionSettings } from "../inspectionSettings";
import { TypeCache } from "../inspection";

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

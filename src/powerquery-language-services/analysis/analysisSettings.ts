// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { IAutocompleteItemProvider, ILibraryProvider, ILocalDocumentProvider } from "../providers";
import { ILibrary } from "../library/library";
import { InspectionSettings } from "../inspectionSettings";
import { TypeCache } from "../inspection";

export interface AnalysisSettings {
    // Each Analysis action generates a cancellation token with this function.
    readonly createCancellationTokenFn: (action: string) => ICancellationToken;
    // Allows injection of custom providers.
    readonly maybeCreateLanguageAutocompleteItemProviderFn?: (locale: string) => IAutocompleteItemProvider;
    readonly maybeCreateLibraryProviderFn?: (library: ILibrary, locale: string) => ILibraryProvider;
    readonly maybeCreateLocalDocumentProviderFn?: (
        uri: string,
        typeCache: TypeCache,
        library: ILibrary,
        locale: string,
    ) => ILocalDocumentProvider;
    readonly inspectionSettings: InspectionSettings;
    readonly isWorkspaceCacheAllowed: boolean;
    readonly maybeInitialCorrelationId: number | undefined;
    readonly traceManager: TraceManager;
}

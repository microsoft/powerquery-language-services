// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { IAutocompleteItemProvider, ILibraryProvider, ILocalDocumentProvider } from "../providers";
import { ILibrary } from "../library/library";
import { InspectionSettings } from "../inspectionSettings";
import { TypeCache } from "../inspection";

export interface AnalysisSettings {
    readonly createCancellationTokenFn: (action: string) => ICancellationToken;
    readonly maybeCreateLanguageAutocompleteItemProviderFn?: () => IAutocompleteItemProvider;
    readonly maybeCreateLibraryProviderFn?: (library: ILibrary) => ILibraryProvider;
    readonly maybeCreateLocalDocumentProviderFn?: (
        uri: string,
        typeCache: TypeCache,
        library: ILibrary,
    ) => ILocalDocumentProvider;
    readonly inspectionSettings: InspectionSettings;
    readonly isWorkspaceCacheAllowed: boolean;
    readonly maybeInitialCorrelationId: number | undefined;
    readonly traceManager: TraceManager;
}

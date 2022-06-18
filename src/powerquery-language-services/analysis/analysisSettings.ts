// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DocumentUri } from "vscode-languageserver-textdocument";
import { TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { IAutocompleteItemProvider, ILocalDocumentProvider, ISymbolProvider } from "../providers/commonTypes";
import { Inspection } from "..";
import { InspectionSettings } from "../inspectionSettings";
import { Library } from "../library";

export interface AnalysisSettings {
    readonly createInspectionSettingsFn: () => InspectionSettings;
    readonly isWorkspaceCacheAllowed: boolean;
    readonly library: Library.ILibrary;
    readonly maybeCreateLanguageAutocompleteItemProviderFn?: () => IAutocompleteItemProvider;
    readonly maybeCreateLibrarySymbolProviderFn?: (library: Library.ILibrary) => ISymbolProvider;
    readonly maybeCreateLocalDocumentProviderFn?: (
        library: Library.ILibrary,
        uri: DocumentUri,
        promiseMaybeInspected: Promise<Inspection.Inspected | undefined>,
        createInspectionSettingsFn: () => InspectionSettings,
    ) => ILocalDocumentProvider;
    readonly maybeInitialCorrelationId: number | undefined;
    readonly symbolProviderTimeoutInMS?: number;
    readonly traceManager: TraceManager;
}

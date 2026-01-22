// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type ICancellationToken } from "@microsoft/powerquery-parser";

import { type InspectionSettings } from "../../inspectionSettings";
import { type Library } from "../../library";

export interface ValidationSettings extends InspectionSettings {
    readonly cancellationToken: ICancellationToken | undefined;
    readonly checkDiagnosticsOnParseError: boolean;
    readonly checkForDuplicateIdentifiers: boolean;
    readonly checkInvokeExpressions: boolean;
    readonly checkUnknownIdentifiers: boolean;
    readonly isWorkspaceCacheAllowed: boolean;
    readonly library: Library.ILibrary;
    readonly source: string;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectionSettings } from "../../inspectionSettings";
import { Library } from "../../library";

export interface ValidationSettings extends InspectionSettings {
    readonly cancellationToken: PQP.ICancellationToken | undefined;
    readonly checkDiagnosticsOnParseError: boolean;
    readonly checkForDuplicateIdentifiers: boolean;
    readonly checkInvokeExpressions: boolean;
    readonly checkUnknownIdentifiers: boolean;
    readonly isWorkspaceCacheAllowed: boolean;
    readonly library: Library.ILibrary;
    readonly source: string;
}

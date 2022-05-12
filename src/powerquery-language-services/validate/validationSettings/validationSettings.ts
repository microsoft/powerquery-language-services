// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { InspectionSettings } from "../../inspectionSettings";
import { Library } from "../../library";

export interface ValidationSettings extends InspectionSettings {
    readonly source: string;
    readonly library: Library.ILibrary;
    readonly checkForDuplicateIdentifiers: boolean;
    readonly checkInvokeExpressions: boolean;
    readonly checkUnknownIdentifiers: boolean;
    readonly isWorkspaceCacheAllowed: boolean;
}

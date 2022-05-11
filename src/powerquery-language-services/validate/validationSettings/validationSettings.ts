// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { InspectionSettings } from "../../inspectionSettings";

export interface ValidationSettings extends InspectionSettings {
    readonly source: string;
    readonly checkForDuplicateIdentifiers: boolean;
    readonly checkInvokeExpressions: boolean;
    readonly checkUnknownIdentifiers: boolean;
    readonly isWorkspaceCacheAllowed: boolean;
}

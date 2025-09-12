// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { InspectionSettings } from "../..";
import { ValidationSettings } from "./validationSettings";

export function createValidationSettings(
    inspectionSettings: InspectionSettings,
    source: string,
    overrides?: Partial<ValidationSettings>,
): ValidationSettings {
    return {
        ...inspectionSettings,
        checkDiagnosticsOnParseError: overrides?.checkDiagnosticsOnParseError ?? true,
        checkForDuplicateIdentifiers: overrides?.checkForDuplicateIdentifiers ?? true,
        checkInvokeExpressions: overrides?.checkInvokeExpressions ?? true,
        checkUnknownIdentifiers: overrides?.checkUnknownIdentifiers ?? true,
        library: inspectionSettings.library,
        source,
    };
}

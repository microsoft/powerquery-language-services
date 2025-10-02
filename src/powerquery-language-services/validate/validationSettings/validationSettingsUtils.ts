// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { InspectionSettings } from "../..";
import { ValidationSettings } from "./validationSettings";

export function createValidationSettings(
    inspectionSettings: InspectionSettings,
    overrides?: Partial<Omit<ValidationSettings, keyof InspectionSettings>>,
): ValidationSettings {
    return {
        ...inspectionSettings,
        checkDiagnosticsOnParseError: overrides?.checkDiagnosticsOnParseError ?? true,
        checkForDuplicateIdentifiers: overrides?.checkForDuplicateIdentifiers ?? true,
        checkInvokeExpressions: overrides?.checkInvokeExpressions ?? true,
        checkUnknownIdentifiers: overrides?.checkUnknownIdentifiers ?? true,
        source: overrides?.source ?? "Unknown Source",
    };
}

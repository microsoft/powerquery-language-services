// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type InspectionSettings } from "../..";
import { type ValidationSettings } from "./validationSettings";

/** Creates a ValidationSettings instance by:
 *  1. shallow copying InspectionSettings
 *  2. applying optional overrides for properties specific to ValidationSettings */
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

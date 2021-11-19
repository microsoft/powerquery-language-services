// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { InspectionSettings } from "../..";
import { ValidationSettings } from "./validationSettings";

export function createValidationSettings(
    inspectionSettings: InspectionSettings,
    source: string,
    checkForDuplicateIdentifiers?: boolean,
    checkInvokeExpressions?: boolean,
): ValidationSettings {
    return {
        ...inspectionSettings,
        checkForDuplicateIdentifiers: checkForDuplicateIdentifiers ?? true,
        checkInvokeExpressions: checkInvokeExpressions ?? true,
        source,
    };
}

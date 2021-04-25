// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectionSettings } from "../../inspection";
import { ValidationSettings } from "./validationSettings";

export function createValidationSettings<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    inspectionSettings: InspectionSettings<S>,
    source: string,
    checkForDuplicateIdentifiers?: boolean,
): ValidationSettings<S> {
    return {
        ...inspectionSettings,
        checkForDuplicateIdentifiers: checkForDuplicateIdentifiers ?? true,
        source,
    };
}

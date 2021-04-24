// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectionSettings } from "../../inspection";

export interface ValidationSettings<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>
    extends InspectionSettings<S> {
    readonly source: string;
    readonly checkForDuplicateIdentifiers: boolean;
}

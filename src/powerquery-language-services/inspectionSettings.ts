// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ExternalType } from "./inspection/externalType";
import { TypeById } from "./inspection";

export interface InspectionSettings extends PQP.Settings {
    readonly maybeEachScopeById: TypeById | undefined;
    readonly maybeExternalTypeResolver: ExternalType.TExternalTypeResolverFn | undefined;
}

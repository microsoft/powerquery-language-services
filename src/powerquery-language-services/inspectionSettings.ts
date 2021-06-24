// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ExternalType } from "./inspection/externalType";

export interface InspectionSettings extends PQP.Settings {
    readonly maybeExternalTypeResolver: ExternalType.TExternalTypeResolverFn | undefined;
}

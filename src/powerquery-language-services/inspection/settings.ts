// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ExternalType } from "./externalType";

export interface InspectionSettings extends PQP.CommonSettings {
    readonly maybeExternalTypeResolver: ExternalType.TExternalTypeResolverFn | undefined;
}

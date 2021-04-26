// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ExternalType } from "./externalType";

export interface InspectionSettings<S extends PQP.Parser.IParseState = PQP.Parser.IParseState> extends PQP.Settings<S> {
    readonly maybeExternalTypeResolver: ExternalType.TExternalTypeResolverFn | undefined;
}

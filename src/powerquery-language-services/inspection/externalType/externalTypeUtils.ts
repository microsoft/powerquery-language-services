// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ExternalInvocationTypeRequest, ExternalTypeRequestKind, ExternalValueTypeRequest } from "./externalType";

export function valueTypeRequestFactory(identifierLiteral: string): ExternalValueTypeRequest {
    return {
        kind: ExternalTypeRequestKind.Value,
        identifierLiteral,
    };
}

export function invocationTypeRequestFactory(
    identifierLiteral: string,
    args: ReadonlyArray<PQP.Language.Type.TType>,
): ExternalInvocationTypeRequest {
    return {
        kind: ExternalTypeRequestKind.Invocation,
        identifierLiteral,
        args,
    };
}

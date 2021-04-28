// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ExternalInvocationTypeRequest, ExternalTypeRequestKind, ExternalValueTypeRequest } from "./externalType";

export function createValueTypeRequest(identifierLiteral: string): ExternalValueTypeRequest {
    return {
        kind: ExternalTypeRequestKind.Value,
        identifierLiteral,
    };
}

export function createInvocationTypeRequest(
    identifierLiteral: string,
    args: ReadonlyArray<PQP.Language.Type.TPowerQueryType>,
): ExternalInvocationTypeRequest {
    return {
        kind: ExternalTypeRequestKind.Invocation,
        identifierLiteral,
        args,
    };
}

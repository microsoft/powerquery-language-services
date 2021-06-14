// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { ExternalType } from ".";

export function createValueTypeRequest(identifierLiteral: string): ExternalType.ExternalValueTypeRequest {
    return {
        kind: ExternalType.ExternalTypeRequestKind.Value,
        identifierLiteral,
    };
}

export function createInvocationTypeRequest(
    identifierLiteral: string,
    args: ReadonlyArray<PQP.Language.Type.TPowerQueryType>,
): ExternalType.ExternalInvocationTypeRequest {
    return {
        kind: ExternalType.ExternalTypeRequestKind.Invocation,
        identifierLiteral,
        args,
    };
}

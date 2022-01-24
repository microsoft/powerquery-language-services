// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { ExternalType } from ".";

export function createValueTypeRequest(identifierLiteral: string): ExternalType.ExternalValueTypeRequest {
    return {
        kind: ExternalType.ExternalTypeRequestKind.Value,
        identifierLiteral,
    };
}

export function createInvocationTypeRequest(
    identifierLiteral: string,
    args: ReadonlyArray<Type.TPowerQueryType>,
): ExternalType.ExternalInvocationTypeRequest {
    return {
        kind: ExternalType.ExternalTypeRequestKind.Invocation,
        identifierLiteral,
        args,
    };
}

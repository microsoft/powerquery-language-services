// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { ExternalType } from ".";

export function composeExternalTypeResolvers(
    ...resolverFns: ReadonlyArray<ExternalType.TExternalTypeResolverFn>
): ExternalType.TExternalTypeResolverFn {
    return (request: ExternalType.TExternalTypeRequest): Type.TPowerQueryType | undefined => {
        for (const resolverFn of resolverFns) {
            const resolvedType: Type.TPowerQueryType | undefined = resolverFn(request);

            if (resolvedType !== undefined) {
                return resolvedType;
            }
        }

        return undefined;
    };
}

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

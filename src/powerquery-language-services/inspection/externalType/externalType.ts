// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Static type analysis isn't always solvable when restricted to local values,
// eg. it could invoke a library function or reference a library value.
//
// We can't bake in the standard library into the language-services layer for a few reasons,
// the biggest being it's up to the service hosting Power Query as to what parts of the library are available.
//
// Instead an API was made to resolve external values, and it's up to the consumer of language-services to
// implement the resolver.
//
// We distinguish between two subtlely different kinds of external types: value and invocation.
// An external request is when there's some identifier not in the local scope.
// An invocation request is when a function invocation happens on some identifier not in the local scope.
//
// The reason for the distinction is that the implementation can be more creative with type resolution.
// Eg. `Table.AddColumn(tbl, "foo", each 1)` could be implemented so the evaluated type is a modification
// of its first argument.

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

export type TExternalTypeRequest = ExternalValueTypeRequest | ExternalInvocationTypeRequest;

export type TExternalTypeResolverFn = (request: TExternalTypeRequest) => Type.TPowerQueryType | undefined;

export type TExternalInvocationTypeResolverFn = (
    request: ExternalInvocationTypeRequest,
) => Promise<Type.TPowerQueryType | undefined>;

export type TExternalValueTypeResolverFn = (
    request: ExternalValueTypeRequest,
) => Promise<Type.TPowerQueryType | undefined>;

export const enum ExternalTypeRequestKind {
    Invocation = "Invocation",
    Value = "Value",
}

export interface IExternalType {
    readonly kind: ExternalTypeRequestKind;
    readonly identifierLiteral: string;
}

export interface ExternalValueTypeRequest extends IExternalType {
    readonly kind: ExternalTypeRequestKind.Value;
}

export interface ExternalInvocationTypeRequest extends IExternalType {
    readonly kind: ExternalTypeRequestKind.Invocation;
    readonly args: ReadonlyArray<Type.TPowerQueryType>;
}

// A null/no-op resolver for when one is required but shouldn't resolve anything,
// Eg. for test mocks.
export function noOpExternalTypeResolver(_request: TExternalTypeRequest): undefined {
    return undefined;
}

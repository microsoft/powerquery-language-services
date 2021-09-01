// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

export type TExternalTypeRequest = ExternalValueTypeRequest | ExternalInvocationTypeRequest;

export type TExternalTypeResolverFn = (request: TExternalTypeRequest) => Type.TPowerQueryType | undefined;

export type TExternalInvocationTypeResolverFn = (
    request: ExternalInvocationTypeRequest,
) => Type.TPowerQueryType | undefined;

export type TExternalValueTypeResolverFn = (request: ExternalValueTypeRequest) => Type.TPowerQueryType | undefined;

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

// A null/no-op resolver for when one is required but shouldn't resolve anything, eg. for test mocks.
export function noOpExternalTypeResolver(_request: TExternalTypeRequest): undefined {
    return undefined;
}

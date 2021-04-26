// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export type TriedInvokeExpression = PQP.Result<InvokeExpression, PQP.CommonError.CommonError>;

export type TriedCurrentInvokeExpression = PQP.Result<CurrentInvokeExpression | undefined, PQP.CommonError.CommonError>;

export interface IInvokeExpression<T extends InvokeExpressionArguments> {
    readonly invokeExpressionXorNode: PQP.Parser.TXorNode;
    readonly functionType: PQP.Language.Type.PowerQueryType;
    readonly isNameInLocalScope: boolean;
    readonly maybeName: string | undefined;
    readonly maybeArguments: T | undefined;
}

export type InvokeExpression = IInvokeExpression<InvokeExpressionArguments>;

export type CurrentInvokeExpression = IInvokeExpression<CurrentInvokeExpressionArguments>;

export interface InvokeExpressionArguments {
    readonly numMaxExpectedArguments: number;
    readonly numMinExpectedArguments: number;
    readonly givenArguments: ReadonlyArray<PQP.Parser.TXorNode>;
    readonly givenArgumentTypes: ReadonlyArray<PQP.Language.Type.PowerQueryType>;
    readonly typeCheck: PQP.Language.TypeUtils.CheckedInvocation;
}

export interface CurrentInvokeExpressionArguments extends InvokeExpressionArguments {
    readonly argumentOrdinal: number;
}

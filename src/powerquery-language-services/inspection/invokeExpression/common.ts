// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export interface IInvokeExpression<T extends InvokeExpressionArguments> {
    readonly invokeExpressionXorNode: PQP.Parser.TXorNode;
    readonly functionType: PQP.Language.Type.TPowerQueryType;
    readonly isNameInLocalScope: boolean;
    readonly maybeName: string | undefined;
    readonly maybeArguments: T | undefined;
}

export interface InvokeExpressionArguments {
    readonly numMaxExpectedArguments: number;
    readonly numMinExpectedArguments: number;
    readonly givenArguments: ReadonlyArray<PQP.Parser.TXorNode>;
    readonly givenArgumentTypes: ReadonlyArray<PQP.Language.Type.TPowerQueryType>;
    readonly typeCheck: PQP.Language.TypeUtils.CheckedInvocation;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export interface IInvokeExpression<T extends InvokeExpressionArguments> {
    readonly invokeExpressionXorNode: TXorNode;
    readonly functionType: Type.TPowerQueryType;
    readonly isNameInLocalScope: boolean;
    readonly name: string | undefined;
    readonly arguments: T | undefined;
}

export interface InvokeExpressionArguments {
    readonly numMaxExpectedArguments: number;
    readonly numMinExpectedArguments: number;
    readonly givenArguments: ReadonlyArray<TXorNode>;
    readonly givenArgumentTypes: ReadonlyArray<Type.TPowerQueryType>;
    readonly typeChecked: TypeUtils.CheckedInvocation;
}

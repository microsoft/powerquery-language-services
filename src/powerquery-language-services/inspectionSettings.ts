// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Library } from "./library";
import { TypeById } from "./inspection";

export enum TypeStrategy {
    // Allow evaluation of extended types (such as AnyUnion).
    Extended = "Extended",
    // Strictly Power Query type primitives.
    Primitive = "Primitive",
}

export interface InspectionSettings extends PQP.Settings {
    // Allows the caching of scope and Power Query type datastructures built during an inspection.
    readonly isWorkspaceCacheAllowed: boolean;
    readonly library: Library.ILibrary;
    // A goal is to enable smart type resolvers for library functions.
    // Take for example `Table.AddColumn(tbl, "nameTwice", each [name] + [name])`
    // There's no way (in the general sense) that you're applying the lambda to the table input.
    // More specifically, it doesn't know the scope of `_` in the EachExpression.
    // I can't think of how to solve this problem in the generalized case
    // without it taking multiple passes and becoming just shy of an evaluator.
    //
    // This is a "simple" hack that enables consumers of language-services to enable those smart type resolvers.
    // An initial pass can be made on InvokeExpressions where it sets the scope for an EachExpression.
    readonly eachScopeById: TypeById | undefined;
    // The type system for Power Query has been expanded in this layer to include types, such as:
    //  * AnyUnion, an extension of `any`
    //  * DefinedTable, an extension of `table`
    // While useful for in-depth analysis and/or Intellisense operations they can be costly in terms of time.
    // Changing the strategy determines how types are evaluated during inspections.
    readonly typeStrategy: TypeStrategy;
    // Cancellation token for long-running inspection operations
    readonly cancellationToken: PQP.ICancellationToken | undefined;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ExternalType } from "./inspection/externalType";
import { TypeById } from "./inspection";

export interface InspectionSettings extends PQP.Settings {
    // Allows the caching of scope and Power Query type datastructures built during an inspection.
    readonly isWorkspaceCacheEnabled: boolean;
    // A goal is to enable smart type resolvers for library functions.
    // Take for example `Table.AddColumn(tbl, "nameTwice", each [name] + [name])`
    // There's no way (in the general sense) that you're applying the lambda to the table input.
    // More specifically, it doesn't know the scope of `_` in the EachExpression.
    // I can't think of how to solve this problem in the generalized case
    // without it taking multiple passes and becoming just shy of an evaluator.
    //
    // This is a "simple" hack that enables consumers of language-services to enable those smart type resolvers.
    // An initial pass can be made on InvokeExpressions where it sets the scope for an EachExpression.
    readonly maybeEachScopeById: TypeById | undefined;
    // Read `externalType.ts` for comments.
    readonly maybeExternalTypeResolver: ExternalType.TExternalTypeResolverFn | undefined;
}

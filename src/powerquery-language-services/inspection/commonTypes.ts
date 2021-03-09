// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Inspection } from "..";
import { TMaybeActiveNode } from "./activeNode";
import { TriedExpectedType } from "./expectedType";

export type TriedInspection = PQP.Result<Inspection, PQP.CommonError.CommonError>;

export interface Inspection {
    readonly maybeActiveNode: TMaybeActiveNode;
    readonly autocomplete: Inspection.Autocomplete;
    readonly triedInvokeExpression: Inspection.TriedInvokeExpression;
    readonly triedNodeScope: Inspection.TriedNodeScope;
    readonly triedScopeType: Inspection.TriedScopeType;
    readonly triedExpectedType: TriedExpectedType;
}

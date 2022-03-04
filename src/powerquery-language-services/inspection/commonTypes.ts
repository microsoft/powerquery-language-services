// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Inspection } from "..";
import { TMaybeActiveNode } from "./activeNode";
import { TriedExpectedType } from "./expectedType";
import { TypeCache } from "./typeCache";

export type TriedInspection = PQP.Result<Inspection, PQP.CommonError.CommonError>;

export interface Inspection {
    readonly maybeActiveNode: TMaybeActiveNode;
    readonly autocomplete: Inspection.Autocomplete;
    readonly triedCurrentInvokeExpression: Promise<Inspection.TriedCurrentInvokeExpression>;
    readonly triedNodeScope: Promise<Inspection.TriedNodeScope>;
    readonly triedScopeType: Promise<Inspection.TriedScopeType>;
    readonly triedExpectedType: TriedExpectedType;
    readonly typeCache: TypeCache;
    readonly parseState: PQP.Parser.ParseState;
}

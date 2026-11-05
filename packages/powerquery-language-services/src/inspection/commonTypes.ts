// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Inspection } from "..";
import { TActiveNode } from "./activeNode";
import { TriedExpectedType } from "./expectedType";
import { TriedNodeScope } from "./scope";
import { TypeCache } from "./typeCache";

export type TriedInspection = PQP.Result<Inspected, PQP.CommonError.CommonError>;

export interface Inspected {
    readonly activeNode: TActiveNode;
    readonly autocomplete: Inspection.Autocomplete;
    readonly triedCurrentInvokeExpression: Promise<Inspection.TriedCurrentInvokeExpression>;
    readonly triedNodeScope: Promise<Inspection.TriedNodeScope>;
    readonly triedScopeType: Promise<Inspection.TriedScopeType>;
    readonly triedExpectedType: TriedExpectedType;
    readonly typeCache: TypeCache;
    readonly parseState: PQP.Parser.ParseState;

    readonly tryNodeScope: (id: number) => Promise<TriedNodeScope>;
    readonly collectAllIdentifiersBeneath: (
        entryNodeId: Ast.Identifier | Ast.GeneralizedIdentifier,
    ) => Promise<Array<Ast.Identifier | Ast.GeneralizedIdentifier>>;
}

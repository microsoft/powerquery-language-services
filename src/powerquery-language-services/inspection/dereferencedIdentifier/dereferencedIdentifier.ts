// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { LetVariableScopeItem, RecordFieldScopeItem, SectionMemberScopeItem } from "../scope";

export enum DereferencedIdentifierKind {
    InScope = "InScope",
    InScopeValue = "InScopeValue",
    External = "External",
    Undefined = "Undefined",
}

export interface IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind;
    readonly identifierLiteral: string;
}

// An identifier that is not in scope and dereferences to an external type.
export interface DereferencedIdentifierExternal extends IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind.External;
    readonly type: TPowerQueryType;
}

// An identifier that is in scope and dereferences to something else.
export interface DereferencedIdentifierInScope extends IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind.InScope;
    readonly nextScopeItem: LetVariableScopeItem | RecordFieldScopeItem | SectionMemberScopeItem;
}

// An identifier that is in scope and has a value node.
export interface DereferencedIdentifierInScopeValue extends IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind.InScopeValue;
    readonly xorNode: TXorNode;
}

// An identifier that is not in scope and has no external type.
export interface DereferencedIdentifierUndefined extends IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind.Undefined;
}

export type TDereferencedIdentifier =
    | DereferencedIdentifierExternal
    | DereferencedIdentifierInScope
    | DereferencedIdentifierInScopeValue
    | DereferencedIdentifierUndefined;

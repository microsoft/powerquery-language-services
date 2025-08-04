// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { LetVariableScopeItem, RecordFieldScopeItem, SectionMemberScopeItem, TScopeItem } from "../scope";

export enum DereferencedIdentifierKind {
    External = "External",
    InScopeDereference = "InScopeDereference",
    InScopeValue = "InScopeValue",
    Recursive = "Recursive",
    Undefined = "Undefined",
}

export interface IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind;
    readonly xorNode: TXorNode;
}

// An identifier that is not in scope and dereferences to an external type.
export interface DereferencedIdentifierExternal extends IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind.External;
    readonly identifierLiteral: string;
    readonly type: TPowerQueryType;
}

// An identifier that is in scope and dereferences to something else.
export interface DereferencedIdentifierInScopeDereference extends IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind.InScopeDereference;
    readonly identifierLiteral: string;
    readonly nextScopeItem: LetVariableScopeItem | RecordFieldScopeItem | SectionMemberScopeItem;
}

// An identifier that is in scope and has a value node.
export interface DereferencedIdentifierInScopeValue extends IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind.InScopeValue;
    readonly scopeItem: TScopeItem;
}

// A recursive identifier, eg. '@foo' which is defined as 'let foo = @foo in foo'.
export interface DereferencedIdentifierRecursive extends IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind.Recursive;
    readonly identifierLiteral: string;
}

// An identifier that is not in scope and has no external type.
export interface DereferencedIdentifierUndefined extends IDereferencedIdentifier {
    readonly kind: DereferencedIdentifierKind.Undefined;
    readonly identifierLiteral: string;
}

export type TDereferencedIdentifier =
    | DereferencedIdentifierExternal
    | DereferencedIdentifierInScopeDereference
    | DereferencedIdentifierInScopeValue
    | DereferencedIdentifierRecursive
    | DereferencedIdentifierUndefined;

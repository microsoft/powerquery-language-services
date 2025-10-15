// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { type Position } from "vscode-languageserver-types";
import { type TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export type TActiveNode =
    // A Position located inside an Ast (either fully or partially parsed).
    | ActiveNode
    // A Position located outside of an Ast (either fully or partially parsed).
    // `| let x = 1 in x` is before the start of the Ast
    | OutOfBoundPosition;

export interface IActiveNode {
    readonly kind: ActiveNodeKind;
    // Position in a text editor.
    readonly position: Position;
}

// An ActiveNode represents the context a user in a text editor expects their cursor to be in.
// Examples:
//  'let x =|' -> The context is the assignment portion of a key-value pair.
//  'foo(12|' -> The context is the numeric literal.
//  `foo(12,|' -> The context is the second (and currently empty) argument of an invoke expression.
export interface ActiveNode extends IActiveNode {
    readonly kind: ActiveNodeKind.ActiveNode;
    readonly leafKind: ActiveNodeLeafKind;
    // A full parental ancestry, starting from the given node all the way up the root node.
    //  - Eg. [starting node, parent of starting node, parent of parent of starting node, ...].
    // Should be of non-zero length. Zero-legnth should be an instance of OutOfBoundPosition.
    readonly ancestry: ReadonlyArray<TXorNode>;
    // A conditional indirection to the leaf if it's an Ast identifier exclusively in (identifierStart, identifierEnd].
    readonly exclusiveIdentifierUnderPosition: TActiveLeafIdentifier | undefined;
    // A conditional indirection to the leaf if it's an Ast identifier inclusively in [identifierStart, identifierEnd].
    readonly inclusiveIdentifierUnderPosition: TActiveLeafIdentifier | undefined;
    // Is the context in the key portion of a key-value-pair.
    //  - Eg. `let foo| = 1 in foo` -> true
    readonly isInKey: boolean;
}

export interface OutOfBoundPosition extends IActiveNode {
    readonly kind: ActiveNodeKind.OutOfBoundPosition;
}

export type TActiveLeafIdentifier = ActiveLeafIdentifierExpression | ActiveLeafIdentifier;

export interface IActiveLeafIdentifier<
    T extends Ast.GeneralizedIdentifier | Ast.Identifier | Ast.IdentifierExpression,
> {
    readonly node: T;
    readonly normalizedLiteral: string;
    readonly normalizedRecursiveLiteral: string | undefined;
}

export interface ActiveLeafIdentifierExpression extends IActiveLeafIdentifier<Ast.IdentifierExpression> {
    readonly node: Ast.IdentifierExpression;
}

export interface ActiveLeafIdentifier extends IActiveLeafIdentifier<Ast.GeneralizedIdentifier | Ast.Identifier> {
    readonly node: Ast.GeneralizedIdentifier | Ast.Identifier;
    readonly normalizedRecursiveLiteral: undefined;
    readonly isRecursive: false;
}

export enum ActiveNodeLeafKind {
    IsBeforePosition = "IsBeforePosition",
    IsInAst = "IsInAst",
    IsAfterPosition = "IsAfterPosition",
    ContextNode = "Context",
}

export enum ActiveNodeKind {
    ActiveNode = "ActiveNode",
    OutOfBoundPosition = "OutOfBoundPosition",
}

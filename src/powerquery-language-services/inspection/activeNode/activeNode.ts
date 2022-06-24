// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import type { Position } from "vscode-languageserver-types";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export type TMaybeActiveNode =
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
    // A full parental ancestry of the starting node.
    // [starting node, parent of starting node, parent of parent of starting node, ...].
    // Must contain at least one element, otherwise it should be an OutOfBoundPosition.
    readonly ancestry: ReadonlyArray<TXorNode>;
    // A conditional indirection to the leaf if it's an Ast identifier exclusively in (identifierStart, identifierEnd].
    readonly maybeExclusiveIdentifierUnderPosition: TLeafIdentifier | undefined;
    // A conditional indirection to the leaf if it's an Ast identifier inclusively in [identifierStart, identifierEnd].
    readonly maybeInclusiveIdentifierUnderPosition: TLeafIdentifier | undefined;
}

export interface OutOfBoundPosition extends IActiveNode {
    readonly kind: ActiveNodeKind.OutOfBoundPosition;
}

export type TLeafIdentifier = LeafIdentifierExpression | LeafIdentifier;

export interface ILeafIdentifier<T extends Ast.GeneralizedIdentifier | Ast.Identifier | Ast.IdentifierExpression> {
    readonly node: T;
    readonly normalizedLiteral: string;
    readonly maybeNormalizedRecursiveLiteral: string | undefined;
    readonly isRecursive: boolean;
}

export interface LeafIdentifierExpression extends ILeafIdentifier<Ast.IdentifierExpression> {
    readonly node: Ast.IdentifierExpression;
}

export interface LeafIdentifier extends ILeafIdentifier<Ast.GeneralizedIdentifier | Ast.Identifier> {
    readonly node: Ast.GeneralizedIdentifier | Ast.Identifier;
    readonly maybeNormalizedRecursiveLiteral: undefined;
    readonly isRecursive: false;
}

export const enum ActiveNodeLeafKind {
    AfterAstNode = "AfterAstNode",
    Anchored = "Anchored",
    ContextNode = "Context",
    OnAstNode = "OnAstNode",
    ShiftedRight = "ShiftedRight",
}

export const enum ActiveNodeKind {
    ActiveNode = "ActiveNode",
    OutOfBoundPosition = "OutOfBoundPosition",
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import type { Position, Range } from "vscode-languageserver-types";
import { Token, TokenKind } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/token";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ActiveNode, ActiveNodeUtils, TActiveNode } from "../activeNode";
import { AutocompleteFieldAccess, InspectedFieldAccess, TriedAutocompleteFieldAccess } from "./commonTypes";
import { AutocompleteTraceConstant, calculateJaroWinkler, CompletionItemKind, PositionUtils, TextEdit } from "../..";
import { TriedType, tryType } from "../type";
import { AutocompleteItem } from "./autocompleteItem";
import { InspectionSettings } from "../../inspectionSettings";
import { TypeCache } from "../typeCache";

export function inspectFieldAccess(
    lexerSnapshot: PQP.Lexer.LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
): InspectedFieldAccess | undefined {
    const fieldProjection: XorNode<Ast.FieldProjection> | undefined = AncestryUtils.findNodeKind<Ast.FieldProjection>(
        activeNode.ancestry,
        Ast.NodeKind.FieldProjection,
    );

    const fieldSelector: XorNode<Ast.FieldSelector> | undefined = AncestryUtils.findNodeKind<Ast.FieldSelector>(
        activeNode.ancestry,
        Ast.NodeKind.FieldSelector,
    );

    if (fieldProjection) {
        return inspectFieldProjection(lexerSnapshot, nodeIdMapCollection, activeNode.position, fieldProjection);
    } else if (fieldSelector) {
        return inspectFieldSelector(lexerSnapshot, nodeIdMapCollection, activeNode.position, fieldSelector);
    } else {
        return undefined;
    }
}

export async function tryAutocompleteFieldAccess(
    settings: InspectionSettings,
    parseState: PQP.Parser.ParseState,
    activeNode: TActiveNode,
    typeCache: TypeCache,
): Promise<TriedAutocompleteFieldAccess> {
    const trace: Trace = settings.traceManager.entry(
        AutocompleteTraceConstant.AutocompleteFieldAccess,
        tryAutocompleteFieldAccess.name,
        settings.initialCorrelationId,
    );

    const updatedSettings: InspectionSettings = {
        ...settings,
        initialCorrelationId: trace.id,
    };

    let result: TriedAutocompleteFieldAccess;

    if (!ActiveNodeUtils.isPositionInBounds(activeNode)) {
        result = ResultUtils.ok(undefined);
    } else {
        result = await ResultUtils.ensureResultAsync(
            () => autocompleteFieldAccess(updatedSettings, parseState, activeNode, typeCache),
            updatedSettings.locale,
        );
    }

    trace.exit({ [TraceConstant.IsError]: ResultUtils.isError(result) });

    return result;
}

const AllowedExtendedTypeKindsForFieldEntries: ReadonlyArray<Type.ExtendedTypeKind> = [
    Type.ExtendedTypeKind.AnyUnion,
    Type.ExtendedTypeKind.DefinedRecord,
    Type.ExtendedTypeKind.DefinedTable,
];

async function autocompleteFieldAccess(
    settings: InspectionSettings,
    parseState: PQP.Parser.ParseState,
    activeNode: ActiveNode,
    typeCache: TypeCache,
): Promise<AutocompleteFieldAccess | undefined> {
    const inspectedFieldAccess: InspectedFieldAccess | undefined = inspectFieldAccess(
        parseState.lexerSnapshot,
        parseState.contextState.nodeIdMapCollection,
        activeNode,
    );

    // No field access was found, or the field access reports no autocomplete is possible.
    // Eg. `[x = 1][x |]`
    if (!inspectedFieldAccess?.isAutocompleteAllowed) {
        return undefined;
    }

    // After a field access was found then find the field it's accessing and inspect the field's Type.
    // This is delayed until after the field access because running static type analysis on an
    // arbitrary field could be costly.
    const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const field: TXorNode | undefined = typablePrimaryExpression(nodeIdMapCollection, activeNode);

    if (field === undefined) {
        return undefined;
    }

    const triedFieldType: TriedType = await tryType(settings, nodeIdMapCollection, field.node.id, typeCache);

    if (ResultUtils.isError(triedFieldType)) {
        throw triedFieldType.error;
    }

    const fieldType: Type.TPowerQueryType = triedFieldType.value;

    // We can only autocomplete a field access if we know what fields are present.
    const fieldEntries: ReadonlyArray<[string, Type.TPowerQueryType]> = fieldEntriesFromFieldType(fieldType);

    if (fieldEntries.length === 0) {
        return undefined;
    }

    return {
        field,
        fieldType,
        inspectedFieldAccess,
        autocompleteItems: createAutocompleteItems(fieldEntries, inspectedFieldAccess),
    };
}

function emptyInspectedFieldAccess(isAutocompleteAllowed: boolean): InspectedFieldAccess {
    return {
        fieldNames: [],
        isAutocompleteAllowed,
        textEditRange: undefined,
        textToAutocompleteUnderPosition: undefined,
    };
}

function fieldEntriesFromFieldType(type: Type.TPowerQueryType): ReadonlyArray<[string, Type.TPowerQueryType]> {
    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.AnyUnion: {
            let fields: [string, Type.TPowerQueryType][] = [];

            for (const field of type.unionedTypePairs) {
                if (field.extendedKind && AllowedExtendedTypeKindsForFieldEntries.includes(field.extendedKind)) {
                    fields = fields.concat(fieldEntriesFromFieldType(field));
                }
            }

            return fields;
        }

        case Type.ExtendedTypeKind.DefinedRecord:
        case Type.ExtendedTypeKind.DefinedTable:
            return [...type.fields.entries()];

        default:
            return [];
    }
}

function inspectFieldProjection(
    lexerSnapshot: PQP.Lexer.LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldProjection: XorNode<Ast.FieldProjection>,
): InspectedFieldAccess {
    const fieldNamesResult: string[] = [];
    let isAutocompleteAllowedResult: boolean = false;
    let textEditRangeResult: Range | undefined;
    let textToAutocompleteUnderPositionResult: string | undefined;

    for (const fieldSelector of NodeIdMapIterator.iterFieldProjection(nodeIdMapCollection, fieldProjection)) {
        const {
            fieldNames,
            isAutocompleteAllowed,
            textEditRange,
            textToAutocompleteUnderPosition,
        }: InspectedFieldAccess = inspectFieldSelector(lexerSnapshot, nodeIdMapCollection, position, fieldSelector);

        fieldNamesResult.push(...fieldNames);

        if (isAutocompleteAllowed) {
            isAutocompleteAllowedResult = isAutocompleteAllowed;
            textEditRangeResult = textEditRange;
            textToAutocompleteUnderPositionResult = textToAutocompleteUnderPosition;
        }
    }

    return {
        fieldNames: fieldNamesResult,
        isAutocompleteAllowed: isAutocompleteAllowedResult,
        textEditRange: textEditRangeResult,
        textToAutocompleteUnderPosition: textToAutocompleteUnderPositionResult,
    };
}

function inspectFieldSelector(
    lexerSnapshot: PQP.Lexer.LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldSelector: XorNode<Ast.FieldSelector>,
): InspectedFieldAccess {
    const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(fieldSelector.node.id);

    if (childIds === undefined) {
        return emptyInspectedFieldAccess(false);
    } else if (childIds.length === 1) {
        return emptyInspectedFieldAccess(nodeIdMapCollection.astNodeById.has(childIds[0]));
    }

    const generalizedIdentifierXor: XorNode<Ast.GeneralizedIdentifier> =
        NodeIdMapUtils.assertXorChecked<Ast.GeneralizedIdentifier>(
            nodeIdMapCollection,
            PQP.ArrayUtils.assertGet(childIds, 1),
            Ast.NodeKind.GeneralizedIdentifier,
        );

    switch (generalizedIdentifierXor.kind) {
        // There isn't a perfect way to determine if an autocomplete should be allowed.
        // Take the following scenario, staring with start with: `let foo = [has a space = 1] in foo`
        // Now the user wants to add a field selector: `let [has a space = 1][| in foo`
        // The parser rules generate a GeneralizedIdentifier `in foo` even though the user wouldn't expect it.
        //
        // The best solution I can think of is the following:
        //  - if it' a fully parsed Ast (ie. there exists a closing bracket) then the entire field is fair game.
        //  - if it's a partial Ast (ie. there is no closing bracket) then only operate on the first identifier token
        case PQP.Parser.XorNodeKind.Ast: {
            const generalizedIdentifier: Ast.GeneralizedIdentifier = generalizedIdentifierXor.node;
            const generalizedIdentifierLiteral: string = generalizedIdentifier.literal;

            const closingBracketNodeId: number = childIds[2];
            const hasClosingBracketAst: boolean = nodeIdMapCollection.astNodeById.has(closingBracketNodeId);

            let isPositionInOrOnIdentifier: boolean;
            let textEditRange: Range | undefined;
            let textToAutocompleteUnderPosition: string | undefined;

            const firstToken: Token | undefined =
                lexerSnapshot.tokens[generalizedIdentifier.tokenRange.tokenIndexStart];

            if (hasClosingBracketAst || !generalizedIdentifierLiteral.includes(" ")) {
                isPositionInOrOnIdentifier = PositionUtils.isInAst(position, generalizedIdentifier, true, true);
                textToAutocompleteUnderPosition = isPositionInOrOnIdentifier ? generalizedIdentifierLiteral : undefined;
                textEditRange = PositionUtils.rangeFromTokenRange(generalizedIdentifier.tokenRange);
            }
            // Given `let _ = [key with space = 1][#"key with space"| in _`
            // assume the user wants to autocomplete the identifier `#"key with space"`
            //
            // Given: `let _ = [key with space = 1][key| in _`
            // assume the user wants to autocomplete the identifier `key`
            else if (firstToken?.kind === TokenKind.Identifier) {
                isPositionInOrOnIdentifier = PositionUtils.isInToken(position, firstToken, true, true);
                textToAutocompleteUnderPosition = isPositionInOrOnIdentifier ? firstToken.data : undefined;
                textEditRange = isPositionInOrOnIdentifier ? PositionUtils.rangeFromToken(firstToken) : undefined;
            } else {
                isPositionInOrOnIdentifier = false;
                textEditRange = undefined;
                textToAutocompleteUnderPosition = undefined;
            }

            return {
                fieldNames: [generalizedIdentifierLiteral],
                isAutocompleteAllowed: isPositionInOrOnIdentifier,
                textEditRange,
                textToAutocompleteUnderPosition,
            };
        }

        case PQP.Parser.XorNodeKind.Context: {
            return {
                fieldNames: [],
                isAutocompleteAllowed: true,
                textEditRange: undefined,
                textToAutocompleteUnderPosition: undefined,
            };
        }

        default:
            throw Assert.isNever(generalizedIdentifierXor);
    }
}

function createAutocompleteItems(
    fieldEntries: ReadonlyArray<[string, Type.TPowerQueryType]>,
    inspectedFieldAccess: InspectedFieldAccess,
): ReadonlyArray<AutocompleteItem> {
    const { textToAutocompleteUnderPosition, textEditRange }: InspectedFieldAccess = inspectedFieldAccess;

    const autocompleteItems: AutocompleteItem[] = [];

    for (const [label, powerQueryType] of fieldEntries) {
        autocompleteItems.push(
            createAutocompleteItem(label, powerQueryType, textToAutocompleteUnderPosition, textEditRange),
        );
    }

    return autocompleteItems;
}

function createAutocompleteItem(
    label: string,
    powerQueryType: Type.TPowerQueryType,
    identifierUnderPositionLiteral: string | undefined,
    textEditRange: Range | undefined,
): AutocompleteItem {
    const jaroWinklerScore: number =
        identifierUnderPositionLiteral !== undefined ? calculateJaroWinkler(label, identifierUnderPositionLiteral) : 1;

    // If the key is a quoted identifier but doesn't need to be one then slice out the quote contents.
    const identifierKind: PQP.Language.TextUtils.IdentifierKind = PQP.Language.TextUtils.identifierKind(label, false);

    const normalizedLabel: string =
        identifierKind === PQP.Language.TextUtils.IdentifierKind.Quote ? label.slice(2, -1) : label;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Field,
        label: normalizedLabel,
        powerQueryType,
        textEdit: textEditRange ? TextEdit.replace(textEditRange, label) : undefined,
    };
}

function typablePrimaryExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
): TXorNode | undefined {
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    let contiguousPrimaryExpression: TXorNode | undefined;
    let matchingContiguousPrimaryExpression: boolean = true;

    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: TXorNode = ancestry[index];

        if (xorNode.node.kind === Ast.NodeKind.RecursivePrimaryExpression) {
            // The previous ancestor must be an attribute of Rpe, which is either its head or ArrrayWrapper.
            const xorNodeBeforeRpe: TXorNode = AncestryUtils.assertNth(ancestry, index - 1);

            // If we're coming from the head node,
            // then return undefined as there can be no nodes before the head ode.
            if (xorNodeBeforeRpe.node.attributeIndex === 0) {
                return undefined;
            }
            // Else if we're coming from the ArrayWrapper,
            // then grab the previous sibling.
            else if (xorNodeBeforeRpe.node.attributeIndex === 1) {
                const rpeChild: TXorNode = AncestryUtils.assertNth(ancestry, index - 2);

                return NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(nodeIdMapCollection, rpeChild.node.id);
            } else {
                throw new PQP.CommonError.InvariantError(
                    `the child of a ${Ast.NodeKind.RecursivePrimaryExpression} should have an attribute index of either 1 or 2`,
                    {
                        parentId: xorNode.node.id,
                        childId: xorNodeBeforeRpe.node.id,
                    },
                );
            }
        } else if (matchingContiguousPrimaryExpression && XorNodeUtils.isTPrimaryExpression(xorNode)) {
            contiguousPrimaryExpression = xorNode;
        } else {
            matchingContiguousPrimaryExpression = false;
        }
    }

    return contiguousPrimaryExpression;
}

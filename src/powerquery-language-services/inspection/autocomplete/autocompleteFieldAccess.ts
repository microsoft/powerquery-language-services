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
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import type { Position } from "vscode-languageserver-types";

import { ActiveNode, ActiveNodeUtils, TActiveNode } from "../activeNode";
import { AutocompleteFieldAccess, InspectedFieldAccess, TriedAutocompleteFieldAccess } from "./commonTypes";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { AutocompleteTraceConstant, PositionUtils } from "../..";
import { TriedType, tryType } from "../type";
import { InspectionSettings } from "../../inspectionSettings";
import { TypeCache } from "../typeCache";

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
    let inspectedFieldAccess: InspectedFieldAccess | undefined = undefined;

    // Option 1: Find a field access node in the ancestry.
    let fieldAccessAncestor: XorNode<Ast.FieldSelector | Ast.FieldProjection> | undefined;

    for (const ancestor of activeNode.ancestry) {
        if (
            XorNodeUtils.isNodeKind<Ast.FieldSelector | Ast.FieldProjection>(ancestor, [
                Ast.NodeKind.FieldSelector,
                Ast.NodeKind.FieldProjection,
            ])
        ) {
            fieldAccessAncestor = ancestor;
        }
    }

    if (fieldAccessAncestor !== undefined) {
        inspectedFieldAccess = inspectFieldAccess(
            parseState.lexerSnapshot,
            parseState.contextState.nodeIdMapCollection,
            activeNode.position,
            fieldAccessAncestor,
        );
    }

    // No field access was found, or the field access reports no autocomplete is possible.
    // Eg. `[x = 1][x |]`
    if (inspectedFieldAccess === undefined || inspectedFieldAccess.isAutocompleteAllowed === false) {
        return undefined;
    }

    // Don't waste time on type analysis if the field access
    // reports it's in an invalid location for an autocomplete.
    if (!inspectedFieldAccess.isAutocompleteAllowed) {
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

function inspectFieldAccess(
    lexerSnapshot: PQP.Lexer.LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldAccess: XorNode<Ast.FieldSelector | Ast.FieldProjection>,
): InspectedFieldAccess {
    switch (fieldAccess.node.kind) {
        case Ast.NodeKind.FieldProjection:
            return inspectFieldProjection(lexerSnapshot, nodeIdMapCollection, position, fieldAccess);

        case Ast.NodeKind.FieldSelector:
            return inspectFieldSelector(lexerSnapshot, nodeIdMapCollection, position, fieldAccess);

        default:
            throw Assert.isNever(fieldAccess.node);
    }
}

function inspectFieldProjection(
    lexerSnapshot: PQP.Lexer.LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldProjection: TXorNode,
): InspectedFieldAccess {
    let isAutocompleteAllowed: boolean = false;
    let identifierUnderPosition: Ast.GeneralizedIdentifier | undefined;
    const fieldNames: string[] = [];

    for (const fieldSelector of NodeIdMapIterator.iterFieldProjection(nodeIdMapCollection, fieldProjection)) {
        const inspectedFieldSelector: InspectedFieldAccess = inspectFieldSelector(
            lexerSnapshot,
            nodeIdMapCollection,
            position,
            fieldSelector,
        );

        if (inspectedFieldSelector.isAutocompleteAllowed || inspectedFieldSelector.identifierUnderPosition) {
            isAutocompleteAllowed = true;
            identifierUnderPosition = inspectedFieldSelector.identifierUnderPosition;
        }

        fieldNames.push(...inspectedFieldSelector.fieldNames);
    }

    return {
        isAutocompleteAllowed,
        identifierUnderPosition,
        fieldNames,
    };
}

function createInspectedFieldAccess(isAutocompleteAllowed: boolean): InspectedFieldAccess {
    return {
        isAutocompleteAllowed,
        identifierUnderPosition: undefined,
        fieldNames: [],
    };
}

function inspectFieldSelector(
    lexerSnapshot: PQP.Lexer.LexerSnapshot,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    fieldSelector: TXorNode,
): InspectedFieldAccess {
    const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(fieldSelector.node.id);

    if (childIds === undefined) {
        return createInspectedFieldAccess(false);
    } else if (childIds.length === 1) {
        return createInspectedFieldAccess(nodeIdMapCollection.astNodeById.has(childIds[0]));
    }

    const generalizedIdentifierId: number = childIds[1];

    const generalizedIdentifierXor: XorNode<Ast.GeneralizedIdentifier> =
        NodeIdMapUtils.assertGetXorChecked<Ast.GeneralizedIdentifier>(
            nodeIdMapCollection,
            generalizedIdentifierId,
            Ast.NodeKind.GeneralizedIdentifier,
        );

    switch (generalizedIdentifierXor.kind) {
        case PQP.Parser.XorNodeKind.Ast: {
            const generalizedIdentifier: Ast.GeneralizedIdentifier = generalizedIdentifierXor.node;
            const isPositionInIdentifier: boolean = PositionUtils.isInAst(position, generalizedIdentifier, true, true);

            return {
                isAutocompleteAllowed: isPositionInIdentifier,
                identifierUnderPosition: isPositionInIdentifier === true ? generalizedIdentifier : undefined,
                fieldNames: [generalizedIdentifier.literal],
            };
        }

        case PQP.Parser.XorNodeKind.Context: {
            // TODO [Autocomplete]:
            // This doesn't take into account of generalized identifiers consisting of multiple tokens.
            // Eg. `foo[bar baz]` or `foo[#"bar baz"].
            const openBracketConstant: Ast.TConstant = NodeIdMapUtils.assertUnboxNthChildAsAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                fieldSelector.node.id,
                0,
                Ast.NodeKind.Constant,
            );

            const nextTokenPosition: PQP.Language.Token.TokenPosition =
                lexerSnapshot.tokens[openBracketConstant.tokenRange.tokenIndexEnd + 1]?.positionStart;

            const isAutocompleteAllowed: boolean =
                PositionUtils.isAfterAst(position, openBracketConstant, false) &&
                (nextTokenPosition === undefined ||
                    PositionUtils.isOnTokenPosition(position, nextTokenPosition) ||
                    PositionUtils.isBeforeTokenPosition(position, nextTokenPosition, true));

            return {
                isAutocompleteAllowed,
                identifierUnderPosition: undefined,
                fieldNames: [],
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
    const fieldAccessNames: ReadonlyArray<string> = inspectedFieldAccess.fieldNames;
    const autocompleteItems: AutocompleteItem[] = [];
    const identifierUnderPositionLiteral: string | undefined = inspectedFieldAccess.identifierUnderPosition?.literal;

    for (const [label, powerQueryType] of fieldEntries) {
        if (fieldAccessNames.includes(label) && label !== identifierUnderPositionLiteral) {
            continue;
        }

        autocompleteItems.push(
            AutocompleteItemUtils.fromFieldAccess(label, powerQueryType, identifierUnderPositionLiteral),
        );
    }

    return autocompleteItems;
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
            const xorNodeBeforeRpe: TXorNode = AncestryUtils.assertGetNthPreviousXor(ancestry, index);

            // If we're coming from the head node,
            // then return undefined as there can be no nodes before the head ode.
            if (xorNodeBeforeRpe.node.attributeIndex === 0) {
                return undefined;
            }
            // Else if we're coming from the ArrayWrapper,
            // then grab the previous sibling.
            else if (xorNodeBeforeRpe.node.attributeIndex === 1) {
                const rpeChild: TXorNode = AncestryUtils.assertGetNthPreviousXor(ancestry, index, 2);

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

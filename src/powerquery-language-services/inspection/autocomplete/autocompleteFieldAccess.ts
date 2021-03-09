// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { Position, PositionUtils } from "../position";
import { InspectionSettings } from "../settings";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../typeCache";
import {
    AutocompleteFieldAccess,
    AutocompleteItem,
    InspectedFieldAccess,
    TriedAutocompleteFieldAccess,
} from "./commonTypes";

export function tryAutocompleteFieldAccess<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: InspectionSettings,
    parseState: S,
    maybeActiveNode: TMaybeActiveNode,
    typeCache: TypeCache,
): TriedAutocompleteFieldAccess {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return PQP.ResultUtils.okFactory(undefined);
    }

    return PQP.ResultUtils.ensureResult(settings.locale, () => {
        return autocompleteFieldAccess(settings, parseState, maybeActiveNode, typeCache);
    });
}

const AllowedExtendedTypeKindsForFieldEntries: ReadonlyArray<PQP.Language.Type.ExtendedTypeKind> = [
    PQP.Language.Type.ExtendedTypeKind.AnyUnion,
    PQP.Language.Type.ExtendedTypeKind.DefinedRecord,
    PQP.Language.Type.ExtendedTypeKind.DefinedTable,
];

const FieldAccessNodeKinds: ReadonlyArray<PQP.Language.Ast.NodeKind> = [
    PQP.Language.Ast.NodeKind.FieldSelector,
    PQP.Language.Ast.NodeKind.FieldProjection,
];

function autocompleteFieldAccess<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: InspectionSettings,
    parseState: S,
    activeNode: ActiveNode,
    typeCache: TypeCache,
): AutocompleteFieldAccess | undefined {
    let maybeInspectedFieldAccess: InspectedFieldAccess | undefined = undefined;

    // Option 1: Find a field access node in the ancestry.
    let maybeFieldAccessAncestor: PQP.Parser.TXorNode | undefined;
    for (const ancestor of activeNode.ancestry) {
        if (FieldAccessNodeKinds.includes(ancestor.node.kind)) {
            maybeFieldAccessAncestor = ancestor;
        }
    }
    if (maybeFieldAccessAncestor !== undefined) {
        maybeInspectedFieldAccess = inspectFieldAccess(
            parseState.lexerSnapshot,
            parseState.contextState.nodeIdMapCollection,
            activeNode.position,
            maybeFieldAccessAncestor,
        );
    }

    // No field access was found, or the field access reports no autocomplete is possible.
    // Eg. `[x = 1][x |]`
    if (maybeInspectedFieldAccess === undefined || maybeInspectedFieldAccess.isAutocompleteAllowed === false) {
        return undefined;
    }
    const inspectedFieldAccess: InspectedFieldAccess = maybeInspectedFieldAccess;

    // Don't waste time on type analysis if the field access
    // reports inspection it's in an invalid autocomplete location.
    if (inspectedFieldAccess.isAutocompleteAllowed === false) {
        return undefined;
    }

    // After a field access was found then find the field it's accessing and inspect the field's PQP.Language.type.
    // This is delayed until after the field access because running static type analysis on an
    // arbitrary field could be costly.
    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const maybeField: PQP.Parser.TXorNode | undefined = maybeTypablePrimaryExpression(nodeIdMapCollection, activeNode);
    if (maybeField === undefined) {
        return undefined;
    }
    const field: PQP.Parser.TXorNode = maybeField;

    const triedFieldType: TriedType = tryType(
        settings,
        nodeIdMapCollection,
        parseState.contextState.leafNodeIds,
        field.node.id,
        typeCache,
    );
    if (PQP.ResultUtils.isErr(triedFieldType)) {
        throw triedFieldType.error;
    }
    const fieldType: PQP.Language.Type.TType = triedFieldType.value;

    // We can only autocomplete a field access if we know what fields are present.
    const fieldEntries: ReadonlyArray<[string, PQP.Language.Type.TType]> = fieldEntriesFromFieldType(fieldType);
    if (fieldEntries.length === 0) {
        return undefined;
    }

    return {
        field,
        fieldType,
        inspectedFieldAccess,
        autocompleteItems: autoCompleteItemsFactory(fieldEntries, inspectedFieldAccess),
    };
}

function fieldEntriesFromFieldType(type: PQP.Language.Type.TType): ReadonlyArray<[string, PQP.Language.Type.TType]> {
    switch (type.maybeExtendedKind) {
        case PQP.Language.Type.ExtendedTypeKind.AnyUnion: {
            let fields: [string, PQP.Language.Type.TType][] = [];
            for (const field of type.unionedTypePairs) {
                if (
                    field.maybeExtendedKind &&
                    AllowedExtendedTypeKindsForFieldEntries.includes(field.maybeExtendedKind)
                ) {
                    fields = fields.concat(fieldEntriesFromFieldType(field));
                }
            }

            return fields;
        }

        case PQP.Language.Type.ExtendedTypeKind.DefinedRecord:
        case PQP.Language.Type.ExtendedTypeKind.DefinedTable:
            return [...type.fields.entries()];

        default:
            return [];
    }
}

function inspectFieldAccess(
    lexerSnapshot: PQP.Lexer.LexerSnapshot,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    fieldAccess: PQP.Parser.TXorNode,
): InspectedFieldAccess {
    switch (fieldAccess.node.kind) {
        case PQP.Language.Ast.NodeKind.FieldProjection:
            return inspectFieldProjection(lexerSnapshot, nodeIdMapCollection, position, fieldAccess);

        case PQP.Language.Ast.NodeKind.FieldSelector:
            return inspectFieldSelector(lexerSnapshot, nodeIdMapCollection, position, fieldAccess);

        default:
            const details: {} = {
                nodeId: fieldAccess.node.id,
                nodeKind: fieldAccess.node.kind,
            };
            throw new PQP.CommonError.InvariantError(
                `fieldAccess should be either ${PQP.Language.Ast.NodeKind.FieldProjection} or ${PQP.Language.Ast.NodeKind.FieldSelector}`,
                details,
            );
    }
}

function inspectFieldProjection(
    lexerSnapshot: PQP.Lexer.LexerSnapshot,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    fieldProjection: PQP.Parser.TXorNode,
): InspectedFieldAccess {
    let isAutocompleteAllowed: boolean = false;
    let maybeIdentifierUnderPosition: string | undefined;
    const fieldNames: string[] = [];

    for (const fieldSelector of PQP.Parser.NodeIdMapIterator.iterFieldProjection(
        nodeIdMapCollection,
        fieldProjection,
    )) {
        const inspectedFieldSelector: InspectedFieldAccess = inspectFieldSelector(
            lexerSnapshot,
            nodeIdMapCollection,
            position,
            fieldSelector,
        );
        if (
            inspectedFieldSelector.isAutocompleteAllowed === true ||
            inspectedFieldSelector.maybeIdentifierUnderPosition !== undefined
        ) {
            isAutocompleteAllowed = true;
            maybeIdentifierUnderPosition = inspectedFieldSelector.maybeIdentifierUnderPosition;
        }
        fieldNames.push(...inspectedFieldSelector.fieldNames);
    }

    return {
        isAutocompleteAllowed,
        maybeIdentifierUnderPosition,
        fieldNames,
    };
}

function inspectedFieldAccessFactory(isAutocompleteAllowed: boolean): InspectedFieldAccess {
    return {
        isAutocompleteAllowed,
        maybeIdentifierUnderPosition: undefined,
        fieldNames: [],
    };
}

function inspectFieldSelector(
    lexerSnapshot: PQP.Lexer.LexerSnapshot,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    fieldSelector: PQP.Parser.TXorNode,
): InspectedFieldAccess {
    const children: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(fieldSelector.node.id);
    if (children === undefined) {
        return inspectedFieldAccessFactory(false);
    } else if (children.length === 1) {
        return inspectedFieldAccessFactory(nodeIdMapCollection.astNodeById.has(children[0]));
    }

    const generalizedIdentifierId: number = children[1];
    const generalizedIdentifierXor: PQP.Parser.TXorNode = PQP.Parser.NodeIdMapUtils.assertGetXor(
        nodeIdMapCollection,
        generalizedIdentifierId,
    );
    Assert.isTrue(
        generalizedIdentifierXor.node.kind === PQP.Language.Ast.NodeKind.GeneralizedIdentifier,
        "generalizedIdentifier.node.kind === PQP.Language.Ast.NodeKind.GeneralizedIdentifier",
    );

    switch (generalizedIdentifierXor.kind) {
        case PQP.Parser.XorNodeKind.Ast: {
            const generalizedIdentifier: PQP.Language.Ast.GeneralizedIdentifier = generalizedIdentifierXor.node as PQP.Language.Ast.GeneralizedIdentifier;
            const isPositionInIdentifier: boolean = PositionUtils.isInAst(position, generalizedIdentifier, true, true);
            return {
                isAutocompleteAllowed: isPositionInIdentifier,
                maybeIdentifierUnderPosition:
                    isPositionInIdentifier === true ? generalizedIdentifier.literal : undefined,
                fieldNames: [generalizedIdentifier.literal],
            };
        }

        case PQP.Parser.XorNodeKind.Context: {
            // TODO [Autocomplete]:
            // This doesn't take into account of generalized identifiers consisting of multiple tokens.
            // Eg. `foo[bar baz]` or `foo[#"bar baz"].
            const openBracketConstant: PQP.Language.Ast.TNode = PQP.Parser.NodeIdMapUtils.assertGetChildAstByAttributeIndex(
                nodeIdMapCollection,
                fieldSelector.node.id,
                0,
                [PQP.Language.Ast.NodeKind.Constant],
            );
            const maybeNextTokenPosition: PQP.Language.Token.TokenPosition =
                lexerSnapshot.tokens[openBracketConstant.tokenRange.tokenIndexEnd + 1]?.positionStart;

            const isAutocompleteAllowed: boolean =
                PositionUtils.isAfterAst(position, openBracketConstant, false) &&
                (maybeNextTokenPosition === undefined ||
                    PositionUtils.isOnTokenPosition(position, maybeNextTokenPosition) ||
                    PositionUtils.isBeforeTokenPosition(position, maybeNextTokenPosition, true));

            return {
                isAutocompleteAllowed,
                maybeIdentifierUnderPosition: undefined,
                fieldNames: [],
            };
        }

        default:
            throw PQP.Assert.isNever(generalizedIdentifierXor);
    }
}

function autoCompleteItemsFactory(
    fieldEntries: ReadonlyArray<[string, PQP.Language.Type.TType]>,
    inspectedFieldAccess: InspectedFieldAccess,
): ReadonlyArray<AutocompleteItem> {
    const fieldAccessNames: ReadonlyArray<string> = inspectedFieldAccess.fieldNames;
    const autocompleteItems: AutocompleteItem[] = [];

    const maybeIdentifierUnderPosition: string | undefined = inspectedFieldAccess.maybeIdentifierUnderPosition;
    for (const [key, type] of fieldEntries) {
        if (
            (fieldAccessNames.includes(key) && key !== maybeIdentifierUnderPosition) ||
            (maybeIdentifierUnderPosition && !key.startsWith(maybeIdentifierUnderPosition))
        ) {
            continue;
        }

        // If the key is a quoted identifier but doesn't need to be one then slice out the quote contents.
        const identifierKind: PQP.StringUtils.IdentifierKind = PQP.StringUtils.identifierKind(key, false);
        const normalizedKey: string = identifierKind === PQP.StringUtils.IdentifierKind.Quote ? key.slice(2, -1) : key;

        autocompleteItems.push({
            key: normalizedKey,
            type,
        });
    }

    return autocompleteItems;
}

function maybeTypablePrimaryExpression(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    activeNode: ActiveNode,
): PQP.Parser.TXorNode | undefined {
    const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;

    let maybeContiguousPrimaryExpression: PQP.Parser.TXorNode | undefined;
    let matchingContiguousPrimaryExpression: boolean = true;
    for (let index: number = 0; index < numAncestors; index += 1) {
        const xorNode: PQP.Parser.TXorNode = ancestry[index];

        if (xorNode.node.kind === PQP.Language.Ast.NodeKind.RecursivePrimaryExpression) {
            // The previous ancestor must be an attribute of Rpe, which is either its head or ArrrayWrapper.
            const xorNodeBeforeRpe: PQP.Parser.TXorNode = PQP.Parser.AncestryUtils.assertGetNthPreviousXor(
                ancestry,
                index,
            );

            // If we're coming from the head node,
            // then return undefined as there can be no nodes before the head ode.
            if (xorNodeBeforeRpe.node.maybeAttributeIndex === 0) {
                return undefined;
            }
            // Else if we're coming from the ArrayWrapper,
            // then grab the previous sibling.
            else if (xorNodeBeforeRpe.node.maybeAttributeIndex === 1) {
                const rpeChild: PQP.Parser.TXorNode = PQP.Parser.AncestryUtils.assertGetNthPreviousXor(
                    ancestry,
                    index,
                    2,
                );
                return PQP.Parser.NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
                    nodeIdMapCollection,
                    rpeChild.node.id,
                );
            } else {
                throw new PQP.CommonError.InvariantError(
                    `the child of a ${PQP.Language.Ast.NodeKind.RecursivePrimaryExpression} should have an attribute index of either 1 or 2`,
                    {
                        parentId: xorNode.node.id,
                        childId: xorNodeBeforeRpe.node.id,
                    },
                );
            }
        } else if (matchingContiguousPrimaryExpression && PQP.Parser.XorNodeUtils.isTPrimaryExpression(xorNode)) {
            maybeContiguousPrimaryExpression = xorNode;
        } else {
            matchingContiguousPrimaryExpression = false;
        }
    }

    return maybeContiguousPrimaryExpression;
}

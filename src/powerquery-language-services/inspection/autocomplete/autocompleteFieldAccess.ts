// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { Position, PositionUtils } from "../position";
import { InspectionSettings } from "../settings";
import { TriedType, tryType } from "../type";
import { TypeCache } from "../typeCache";
import { AutocompleteItem, AutocompleteItemUtils } from "./autocompleteItem";
import { AutocompleteFieldAccess, InspectedFieldAccess, TriedAutocompleteFieldAccess } from "./commonTypes";

export function tryAutocompleteFieldAccess<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: InspectionSettings,
    parseState: S,
    maybeActiveNode: TMaybeActiveNode,
    typeCache: TypeCache,
): TriedAutocompleteFieldAccess {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return PQP.ResultUtils.createOk(undefined);
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
    // reports it's in an invalid location for an autocomplete.
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
    if (PQP.ResultUtils.isError(triedFieldType)) {
        throw triedFieldType.error;
    }
    const fieldType: PQP.Language.Type.PowerQueryType = triedFieldType.value;

    // We can only autocomplete a field access if we know what fields are present.
    const fieldEntries: ReadonlyArray<[string, PQP.Language.Type.PowerQueryType]> = fieldEntriesFromFieldType(
        fieldType,
    );
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

function fieldEntriesFromFieldType(
    type: PQP.Language.Type.PowerQueryType,
): ReadonlyArray<[string, PQP.Language.Type.PowerQueryType]> {
    switch (type.maybeExtendedKind) {
        case PQP.Language.Type.ExtendedTypeKind.AnyUnion: {
            let fields: [string, PQP.Language.Type.PowerQueryType][] = [];
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
    let maybeIdentifierUnderPosition: PQP.Language.Ast.GeneralizedIdentifier | undefined;
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
        if (inspectedFieldSelector.isAutocompleteAllowed || inspectedFieldSelector.maybeIdentifierUnderPosition) {
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

function createInspectedFieldAccess(isAutocompleteAllowed: boolean): InspectedFieldAccess {
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
    const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(fieldSelector.node.id);
    if (childIds === undefined) {
        return createInspectedFieldAccess(false);
    } else if (childIds.length === 1) {
        return createInspectedFieldAccess(nodeIdMapCollection.astNodeById.has(childIds[0]));
    }

    const generalizedIdentifierId: number = childIds[1];
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
                maybeIdentifierUnderPosition: isPositionInIdentifier === true ? generalizedIdentifier : undefined,
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

function createAutocompleteItems(
    fieldEntries: ReadonlyArray<[string, PQP.Language.Type.PowerQueryType]>,
    inspectedFieldAccess: InspectedFieldAccess,
): ReadonlyArray<AutocompleteItem> {
    const fieldAccessNames: ReadonlyArray<string> = inspectedFieldAccess.fieldNames;
    const autocompleteItems: AutocompleteItem[] = [];
    const maybeIdentifierUnderPositionLiteral: string | undefined =
        inspectedFieldAccess.maybeIdentifierUnderPosition?.literal;

    for (const [label, powerQueryType] of fieldEntries) {
        if (fieldAccessNames.includes(label) && label !== maybeIdentifierUnderPositionLiteral) {
            continue;
        }

        autocompleteItems.push(
            AutocompleteItemUtils.createFromFieldAccess(label, powerQueryType, maybeIdentifierUnderPositionLiteral),
        );
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

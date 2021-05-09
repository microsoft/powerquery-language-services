// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { Inspection } from "../../..";
import { ExternalType, ExternalTypeUtils } from "../../externalType";
import { NodeScope, ParameterScopeItem, ScopeById, ScopeItemKind, tryNodeScope, TScopeItem } from "../../scope";
import { TypeById } from "../../typeCache";
import { inspectTypeConstant } from "./inspectTypeConstant";
import { inspectTypeEachExpression } from "./inspectTypeEachExpression";
import { inspectTypeErrorHandlingExpression } from "./inspectTypeErrorHandlingExpression";
import { inspectTypeFieldProjection } from "./inspectTypeFieldProjection";
import { inspectTypeFieldSelector } from "./inspectTypeFieldSelector";
import { inspectTypeFieldSpecification } from "./inspectTypeFieldSpecification";
import { inspectTypeFunctionExpression } from "./inspectTypeFunctionExpression";
import { inspectTypeFunctionType } from "./inspectTypeFunctionType";
import { inspectTypeIdentifier } from "./inspectTypeIdentifier";
import { inspectTypeIdentifierExpression } from "./inspectTypeIdentifierExpression";
import { inspectTypeIfExpression } from "./inspectTypeIfExpression";
import { inspectTypeInvokeExpression } from "./inspectTypeInvokeExpression";
import { inspectTypeList } from "./inspectTypeList";
import { inspectTypeListType } from "./inspectTypeListType";
import { inspectTypeLiteralExpression } from "./inspectTypeLiteralExpression";
import { inspectTypeNullCoalescingExpression } from "./inspectTypeNullCoalescingExpression";
import { inspectTypeParameter } from "./inspectTypeParameter";
import { inspectTypePrimitiveType } from "./inspectTypePrimitiveType";
import { inspectTypeRangeExpression } from "./inspectTypeRangeExpression";
import { inspectTypeRecord } from "./inspectTypeRecord";
import { inspectTypeRecordType } from "./inspectTypeRecordType";
import { inspectTypeRecursivePrimaryExpression } from "./inspectTypeRecursivePrimaryExpression";
import { inspectTypeTableType } from "./inspectTypeTableType";
import { inspectTypeTBinOpExpression } from "./inspectTypeTBinOpExpression";
import { inspectTypeUnaryExpression } from "./inspectTypeUnaryExpression";

export interface InspectTypeState<S extends PQP.Parser.IParseState = PQP.Parser.IParseState> {
    readonly settings: Inspection.InspectionSettings<S>;
    readonly givenTypeById: TypeById;
    readonly deltaTypeById: TypeById;
    readonly nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection;
    readonly scopeById: ScopeById;
}

// Recursively flattens all AnyUnion.unionedTypePairs into a single array,
// maps each entry into a boolean,
// then calls all(...) on the mapped values.
export function allForAnyUnion(
    anyUnion: PQP.Language.Type.AnyUnion,
    conditionFn: (type: PQP.Language.Type.TPowerQueryType) => boolean,
): boolean {
    return (
        anyUnion.unionedTypePairs
            .map((type: PQP.Language.Type.TPowerQueryType) => {
                return type.maybeExtendedKind === PQP.Language.Type.ExtendedTypeKind.AnyUnion
                    ? allForAnyUnion(type, conditionFn)
                    : conditionFn(type);
            })
            .indexOf(false) === -1
    );
}

export function assertGetOrCreateNodeScope<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    nodeId: number,
): NodeScope {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    const triedGetOrCreateScope: Inspection.TriedNodeScope = getOrCreateScope(state, nodeId);
    if (PQP.ResultUtils.isError(triedGetOrCreateScope)) {
        throw triedGetOrCreateScope;
    }

    return Assert.asDefined(triedGetOrCreateScope.value);
}

export function getOrCreateScope<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    nodeId: number,
): Inspection.TriedNodeScope {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    const maybeNodeScope: NodeScope | undefined = state.scopeById.get(nodeId);
    if (maybeNodeScope !== undefined) {
        return PQP.ResultUtils.createOk(maybeNodeScope);
    }

    return tryNodeScope(state.settings, state.nodeIdMapCollection, nodeId, state.scopeById);
}

export function getOrCreateScopeItemType<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    scopeItem: TScopeItem,
): PQP.Language.Type.TPowerQueryType {
    const nodeId: number = scopeItem.id;

    const maybeGivenType: PQP.Language.Type.TPowerQueryType | undefined = state.givenTypeById.get(nodeId);
    if (maybeGivenType !== undefined) {
        return maybeGivenType;
    }

    const maybeDeltaType: PQP.Language.Type.TPowerQueryType | undefined = state.givenTypeById.get(nodeId);
    if (maybeDeltaType !== undefined) {
        return maybeDeltaType;
    }

    const scopeType: PQP.Language.Type.TPowerQueryType = inspectScopeItem(state, scopeItem);
    return scopeType;
}

export function inspectScopeItem<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    scopeItem: TScopeItem,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    switch (scopeItem.kind) {
        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            return scopeItem.maybeValue === undefined
                ? PQP.Language.Type.UnknownInstance
                : inspectXor(state, scopeItem.maybeValue);

        case ScopeItemKind.Each:
            return inspectXor(state, scopeItem.eachExpression);

        case ScopeItemKind.Parameter:
            return createParameterType(scopeItem);

        case ScopeItemKind.Undefined:
            return PQP.Language.Type.UnknownInstance;

        default:
            throw Assert.isNever(scopeItem);
    }
}

export function inspectTypeFromChildAttributeIndex<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    parentXorNode: PQP.Parser.TXorNode,
    attributeIndex: number,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    const maybeXorNode: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(
        state.nodeIdMapCollection,
        parentXorNode.node.id,
        attributeIndex,
        undefined,
    );
    return maybeXorNode !== undefined ? inspectXor(state, maybeXorNode) : PQP.Language.Type.UnknownInstance;
}

export function inspectXor<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    const xorNodeId: number = xorNode.node.id;
    const maybeCached: PQP.Language.Type.TPowerQueryType | undefined =
        state.givenTypeById.get(xorNodeId) || state.deltaTypeById.get(xorNodeId);
    if (maybeCached !== undefined) {
        return maybeCached;
    }

    let result: PQP.Language.Type.TPowerQueryType;
    switch (xorNode.node.kind) {
        case PQP.Language.Ast.NodeKind.ArrayWrapper:
        case PQP.Language.Ast.NodeKind.FieldSpecificationList:
        case PQP.Language.Ast.NodeKind.GeneralizedIdentifier:
        case PQP.Language.Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case PQP.Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case PQP.Language.Ast.NodeKind.IdentifierPairedExpression:
        case PQP.Language.Ast.NodeKind.ParameterList:
        case PQP.Language.Ast.NodeKind.Section:
            return PQP.Language.Type.NotApplicableInstance;

        case PQP.Language.Ast.NodeKind.AsType:
        case PQP.Language.Ast.NodeKind.AsNullablePrimitiveType:
        case PQP.Language.Ast.NodeKind.FieldTypeSpecification:
        case PQP.Language.Ast.NodeKind.OtherwiseExpression:
        case PQP.Language.Ast.NodeKind.ParenthesizedExpression:
        case PQP.Language.Ast.NodeKind.TypePrimaryType:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 1);
            break;

        case PQP.Language.Ast.NodeKind.ArithmeticExpression:
        case PQP.Language.Ast.NodeKind.EqualityExpression:
        case PQP.Language.Ast.NodeKind.LogicalExpression:
        case PQP.Language.Ast.NodeKind.RelationalExpression:
            result = inspectTypeTBinOpExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.AsExpression:
        case PQP.Language.Ast.NodeKind.SectionMember:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 2);
            break;

        case PQP.Language.Ast.NodeKind.Csv:
        case PQP.Language.Ast.NodeKind.MetadataExpression:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
            break;

        case PQP.Language.Ast.NodeKind.ListExpression:
        case PQP.Language.Ast.NodeKind.ListLiteral:
            result = inspectTypeList(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.NullableType:
        case PQP.Language.Ast.NodeKind.NullablePrimitiveType:
            result = {
                ...inspectTypeFromChildAttributeIndex(state, xorNode, 1),
                isNullable: true,
            };
            break;

        case PQP.Language.Ast.NodeKind.RecordLiteral:
        case PQP.Language.Ast.NodeKind.RecordExpression:
            result = inspectTypeRecord(state, xorNode);
            break;

        // TODO: how should error raising be typed?
        case PQP.Language.Ast.NodeKind.ErrorRaisingExpression:
            result = PQP.Language.Type.AnyInstance;
            break;

        case PQP.Language.Ast.NodeKind.Constant:
            result = inspectTypeConstant(xorNode);
            break;

        case PQP.Language.Ast.NodeKind.EachExpression:
            result = inspectTypeEachExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.ErrorHandlingExpression:
            result = inspectTypeErrorHandlingExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.FieldProjection:
            result = inspectTypeFieldProjection(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.FieldSelector:
            result = inspectTypeFieldSelector(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.FieldSpecification:
            result = inspectTypeFieldSpecification(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.FunctionExpression:
            result = inspectTypeFunctionExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.FunctionType:
            result = inspectTypeFunctionType(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.Identifier:
            result = inspectTypeIdentifier(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.IdentifierExpression:
            result = inspectTypeIdentifierExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.IfExpression:
            result = inspectTypeIfExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.IsExpression:
            result = PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Logical);
            break;

        case PQP.Language.Ast.NodeKind.InvokeExpression:
            result = inspectTypeInvokeExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.IsNullablePrimitiveType:
            result = PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Logical);
            break;

        case PQP.Language.Ast.NodeKind.ItemAccessExpression:
            result = PQP.Language.Type.AnyInstance;
            break;

        case PQP.Language.Ast.NodeKind.LetExpression:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 3);
            break;

        case PQP.Language.Ast.NodeKind.ListType:
            result = inspectTypeListType(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.LiteralExpression:
            result = inspectTypeLiteralExpression(xorNode);
            break;

        case PQP.Language.Ast.NodeKind.NotImplementedExpression:
            result = PQP.Language.Type.NoneInstance;
            break;

        case PQP.Language.Ast.NodeKind.NullCoalescingExpression:
            result = inspectTypeNullCoalescingExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.Parameter:
            result = inspectTypeParameter(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.PrimitiveType:
            result = inspectTypePrimitiveType(xorNode);
            break;

        case PQP.Language.Ast.NodeKind.RangeExpression:
            result = inspectTypeRangeExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.RecordType:
            result = inspectTypeRecordType(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.RecursivePrimaryExpression:
            result = inspectTypeRecursivePrimaryExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.TableType:
            result = inspectTypeTableType(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.UnaryExpression:
            result = inspectTypeUnaryExpression(state, xorNode);
            break;

        default:
            throw Assert.isNever(xorNode.node);
    }

    state.deltaTypeById.set(xorNodeId, result);
    return result;
}

export function maybeDereferencedIdentifierType<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType | undefined {
    state.settings.maybeCancellationToken?.throwIfCancelled();

    const deferenced: PQP.Parser.TXorNode = recursiveIdentifierDereference(state, xorNode);

    const maybeDereferencedLiteral: string | undefined = PQP.Parser.XorNodeUtils.maybeIdentifierExpressionLiteral(
        deferenced,
    );
    if (maybeDereferencedLiteral === undefined) {
        return undefined;
    }
    const deferencedLiteral: string = maybeDereferencedLiteral;

    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, deferenced.node.id);
    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(deferencedLiteral);
    // The deferenced identifier can't be resolved within the local scope.
    // It either is either an invalid identifier or an external identifier (e.g `Odbc.Database`).
    if (maybeScopeItem === undefined) {
        const maybeResolver: ExternalType.TExternalTypeResolverFn | undefined =
            state.settings.maybeExternalTypeResolver;

        if (maybeResolver === undefined) {
            return undefined;
        }

        const request: ExternalType.ExternalValueTypeRequest = ExternalTypeUtils.createValueTypeRequest(
            deferencedLiteral,
        );
        return maybeResolver(request);
    }
    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: PQP.Parser.TXorNode | undefined;
    switch (scopeItem.kind) {
        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        case ScopeItemKind.Each:
            maybeNextXorNode = scopeItem.eachExpression;
            break;

        case ScopeItemKind.Parameter:
            return createParameterType(scopeItem);

        case ScopeItemKind.Undefined:
            return undefined;

        default:
            throw Assert.isNever(scopeItem);
    }

    if (maybeNextXorNode === undefined) {
        return undefined;
    }
    return inspectXor(state, maybeNextXorNode);
}

// Recursively derefence an identifier if it points to another identifier.
export function recursiveIdentifierDereference<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Parser.TXorNode {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertIsIdentifier(xorNode);

    return Assert.asDefined(recursiveIdentifierDereferenceHelper(state, xorNode));
}

// Recursively derefence an identifier if it points to another identifier.
function recursiveIdentifierDereferenceHelper<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Parser.TXorNode | undefined {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertIsIdentifier(xorNode);

    if (xorNode.kind === PQP.Parser.XorNodeKind.Context) {
        return undefined;
    }
    const identifier: PQP.Language.Ast.Identifier | PQP.Language.Ast.IdentifierExpression = xorNode.node as
        | PQP.Language.Ast.Identifier
        | PQP.Language.Ast.IdentifierExpression;
    const identifierId: number = identifier.id;

    let identifierLiteral: string;
    let isRecursiveIdentifier: boolean;

    switch (identifier.kind) {
        case PQP.Language.Ast.NodeKind.Identifier:
            identifierLiteral = identifier.literal;
            isRecursiveIdentifier = false;
            break;

        case PQP.Language.Ast.NodeKind.IdentifierExpression:
            identifierLiteral = identifier.identifier.literal;
            isRecursiveIdentifier = identifier.maybeInclusiveConstant !== undefined;
            break;

        default:
            throw Assert.isNever(identifier);
    }

    // TODO: handle recursive identifiers
    if (isRecursiveIdentifier === true) {
        return xorNode;
    }

    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, identifierId);

    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(identifierLiteral);
    if (maybeScopeItem === undefined) {
        return xorNode;
    }
    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: PQP.Parser.TXorNode | undefined;
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
        case ScopeItemKind.Parameter:
        case ScopeItemKind.Undefined:
            return xorNode;

        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        default:
            throw Assert.isNever(scopeItem);
    }

    return maybeNextXorNode !== undefined &&
        maybeNextXorNode.kind !== PQP.Parser.XorNodeKind.Context &&
        (maybeNextXorNode.node.kind === PQP.Language.Ast.NodeKind.Identifier ||
            maybeNextXorNode.node.kind === PQP.Language.Ast.NodeKind.IdentifierExpression)
        ? recursiveIdentifierDereferenceHelper(state, maybeNextXorNode)
        : xorNode;
}

export function createParameterType(parameter: ParameterScopeItem): PQP.Language.Type.TPrimitiveType {
    if (parameter.maybeType === undefined) {
        return PQP.Language.Type.NoneInstance;
    }

    return {
        kind: PQP.Language.TypeUtils.typeKindFromPrimitiveTypeConstantKind(parameter.maybeType),
        maybeExtendedKind: undefined,
        isNullable: parameter.isNullable,
    };
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ExternalType, ExternalTypeUtils } from "../../externalType";
import { Inspection, LanguageServiceTraceConstant, TraceUtils } from "../../..";
import { NodeScope, ParameterScopeItem, ScopeById, ScopeItemKind, tryNodeScope, TScopeItem } from "../../scope";
import { InspectionSettings } from "../../../inspectionSettings";
import { inspectTypeConstant } from "./inspectTypeConstant";
import { inspectTypeEachExpression } from "./inspectTypeEachExpression";
import { inspectTypeErrorHandlingExpression } from "./inspectTypeErrorHandlingExpression";
import { inspectTypeFieldProjection } from "./inspectTypeField/inspectTypeFieldProjection";
import { inspectTypeFieldSelector } from "./inspectTypeField/inspectTypeFieldSelector";
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
import { TypeById } from "../../typeCache";

// Drops PQP.LexSettings and PQP.ParseSettings as they're not needed.
export interface InspectTypeState
    extends PQP.CommonSettings,
        Omit<InspectionSettings, keyof PQP.LexSettings | keyof PQP.ParseSettings> {
    readonly givenTypeById: TypeById;
    readonly deltaTypeById: TypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly scopeById: ScopeById;
}

// Recursively flattens all AnyUnion.unionedTypePairs into a single array,
// maps each entry into a boolean,
// then calls all(...) on the mapped values.
export function allForAnyUnion(anyUnion: Type.AnyUnion, conditionFn: (type: Type.TPowerQueryType) => boolean): boolean {
    return (
        anyUnion.unionedTypePairs
            .map((type: Type.TPowerQueryType) =>
                type.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion
                    ? allForAnyUnion(type, conditionFn)
                    : conditionFn(type),
            )
            .indexOf(false) === -1
    );
}

export async function assertGetOrCreateNodeScope(state: InspectTypeState, nodeId: number): Promise<NodeScope> {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedGetOrCreateScope: Inspection.TriedNodeScope = await getOrCreateScope(state, nodeId);

    if (ResultUtils.isError(triedGetOrCreateScope)) {
        throw triedGetOrCreateScope;
    }

    return Assert.asDefined(triedGetOrCreateScope.value);
}

export async function getOrCreateScope(state: InspectTypeState, nodeId: number): Promise<Inspection.TriedNodeScope> {
    state.maybeCancellationToken?.throwIfCancelled();

    const maybeNodeScope: NodeScope | undefined = state.scopeById.get(nodeId);

    if (maybeNodeScope !== undefined) {
        return ResultUtils.boxOk(maybeNodeScope);
    }

    return await tryNodeScope(state, state.nodeIdMapCollection, nodeId, state.scopeById);
}

export async function getOrCreateScopeItemType(
    state: InspectTypeState,
    scopeItem: TScopeItem,
): Promise<Type.TPowerQueryType> {
    const nodeId: number = scopeItem.id;

    const maybeGivenType: Type.TPowerQueryType | undefined = state.givenTypeById.get(nodeId);

    if (maybeGivenType !== undefined) {
        return maybeGivenType;
    }

    const maybeDeltaType: Type.TPowerQueryType | undefined = state.givenTypeById.get(nodeId);

    if (maybeDeltaType !== undefined) {
        return maybeDeltaType;
    }

    const scopeType: Type.TPowerQueryType = await inspectScopeItem(state, scopeItem);

    return scopeType;
}

export async function inspectScopeItem(state: InspectTypeState, scopeItem: TScopeItem): Promise<Type.TPowerQueryType> {
    state.maybeCancellationToken?.throwIfCancelled();

    switch (scopeItem.kind) {
        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            return scopeItem.maybeValue === undefined
                ? Type.UnknownInstance
                : await inspectXor(state, scopeItem.maybeValue);

        case ScopeItemKind.Each:
            return await inspectXor(state, scopeItem.eachExpression);

        case ScopeItemKind.Parameter:
            return createParameterType(scopeItem);

        case ScopeItemKind.Undefined:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(scopeItem);
    }
}

export async function inspectTypeFromChildAttributeIndex(
    state: InspectTypeState,
    parentXorNode: TXorNode,
    attributeIndex: number,
): Promise<Type.TPowerQueryType> {
    state.maybeCancellationToken?.throwIfCancelled();

    const maybeXorNode: TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeNthChild(
        state.nodeIdMapCollection,
        parentXorNode.node.id,
        attributeIndex,
    );

    return maybeXorNode !== undefined ? await inspectXor(state, maybeXorNode) : Type.UnknownInstance;
}

export async function inspectXor(state: InspectTypeState, xorNode: TXorNode): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectXor.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const xorNodeId: number = xorNode.node.id;

    const maybeCached: Type.TPowerQueryType | undefined =
        state.givenTypeById.get(xorNodeId) || state.deltaTypeById.get(xorNodeId);

    if (maybeCached !== undefined) {
        return Promise.resolve(maybeCached);
    }

    let result: Type.TPowerQueryType;

    switch (xorNode.node.kind) {
        case Ast.NodeKind.ArrayWrapper:
        case Ast.NodeKind.FieldSpecificationList:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.Section:
            return Promise.resolve(Type.NotApplicableInstance);

        case Ast.NodeKind.AsType:
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.FieldTypeSpecification:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.TypePrimaryType:
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 1);
            break;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = await inspectTypeTBinOpExpression(state, xorNode);
            break;

        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.SectionMember:
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 2);
            break;

        case Ast.NodeKind.Csv:
        case Ast.NodeKind.MetadataExpression:
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 0);
            break;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
            result = await inspectTypeList(state, xorNode);
            break;

        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.NullablePrimitiveType:
            result = {
                ...(await inspectTypeFromChildAttributeIndex(state, xorNode, 1)),
                isNullable: true,
            };

            break;

        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordExpression:
            result = await inspectTypeRecord(state, xorNode);
            break;

        // TODO: how should error raising be typed?
        case Ast.NodeKind.ErrorRaisingExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.Constant:
            result = inspectTypeConstant(xorNode);
            break;

        case Ast.NodeKind.EachExpression:
            result = await inspectTypeEachExpression(state, xorNode);
            break;

        case Ast.NodeKind.ErrorHandlingExpression:
            result = await inspectTypeErrorHandlingExpression(state, xorNode);
            break;

        case Ast.NodeKind.FieldProjection:
            result = await inspectTypeFieldProjection(state, xorNode);
            break;

        case Ast.NodeKind.FieldSelector:
            result = await inspectTypeFieldSelector(state, xorNode);
            break;

        case Ast.NodeKind.FieldSpecification:
            result = await inspectTypeFieldSpecification(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            result = await inspectTypeFunctionExpression(state, xorNode);
            break;

        case Ast.NodeKind.FunctionType:
            result = await inspectTypeFunctionType(state, xorNode);
            break;

        case Ast.NodeKind.Identifier:
            result = await inspectTypeIdentifier(state, xorNode);
            break;

        case Ast.NodeKind.IdentifierExpression:
            result = await inspectTypeIdentifierExpression(state, xorNode);
            break;

        case Ast.NodeKind.IfExpression:
            result = await inspectTypeIfExpression(state, xorNode);
            break;

        case Ast.NodeKind.IsExpression:
            result = TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical);
            break;

        case Ast.NodeKind.InvokeExpression:
            result = await inspectTypeInvokeExpression(state, xorNode);
            break;

        case Ast.NodeKind.IsNullablePrimitiveType:
            result = TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical);
            break;

        case Ast.NodeKind.ItemAccessExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.LetExpression:
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 3);
            break;

        case Ast.NodeKind.ListType:
            result = await inspectTypeListType(state, xorNode);
            break;

        case Ast.NodeKind.LiteralExpression:
            result = inspectTypeLiteralExpression(state, xorNode);
            break;

        case Ast.NodeKind.NotImplementedExpression:
            result = Type.NoneInstance;
            break;

        case Ast.NodeKind.NullCoalescingExpression:
            result = await inspectTypeNullCoalescingExpression(state, xorNode);
            break;

        case Ast.NodeKind.Parameter:
            result = await inspectTypeParameter(state, xorNode);
            break;

        case Ast.NodeKind.PrimitiveType:
            result = inspectTypePrimitiveType(state, xorNode);
            break;

        case Ast.NodeKind.RangeExpression:
            result = await inspectTypeRangeExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordType:
            result = await inspectTypeRecordType(state, xorNode);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            result = await inspectTypeRecursivePrimaryExpression(state, xorNode);
            break;

        case Ast.NodeKind.TableType:
            result = await inspectTypeTableType(state, xorNode);
            break;

        case Ast.NodeKind.UnaryExpression:
            result = await inspectTypeUnaryExpression(state, xorNode);
            break;

        default:
            throw Assert.isNever(xorNode.node);
    }

    state.deltaTypeById.set(xorNodeId, result);
    trace.exit({ resultKind: result.kind, maybeResultExtendedKind: result.maybeExtendedKind });

    return result;
}

export async function maybeDereferencedIdentifierType(
    state: InspectTypeState,
    xorNode: TXorNode,
): Promise<Type.TPowerQueryType | undefined> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        maybeDereferencedIdentifierType.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const deferenced: TXorNode = await recursiveIdentifierDereference(state, xorNode);

    const maybeDereferencedLiteral: string | undefined = XorNodeUtils.maybeIdentifierExpressionLiteral(deferenced);

    if (maybeDereferencedLiteral === undefined) {
        return undefined;
    }

    const deferencedLiteral: string = maybeDereferencedLiteral;

    const nodeScope: NodeScope = await assertGetOrCreateNodeScope(state, deferenced.node.id);

    // When referencing an identifier as a recursive identifier there's no requirements
    // for it to resolve to a recursive reference.
    // This if it's a recursive identifier we need to also try the identifier without the recursive `@` prefix.
    let maybeScopeItem: TScopeItem | undefined = nodeScope.get(deferencedLiteral);

    if (deferencedLiteral.startsWith("@") && maybeScopeItem === undefined) {
        maybeScopeItem = nodeScope.get(deferencedLiteral.slice(1));
    }

    // The deferenced identifier can't be resolved within the local scope.
    // It either is either an invalid identifier or an external identifier (e.g `Odbc.Database`).
    if (maybeScopeItem === undefined) {
        const maybeResolver: ExternalType.TExternalTypeResolverFn | undefined = state.maybeExternalTypeResolver;

        if (maybeResolver === undefined) {
            return undefined;
        }

        const request: ExternalType.ExternalValueTypeRequest =
            ExternalTypeUtils.createValueTypeRequest(deferencedLiteral);

        return maybeResolver(request);
    }

    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: TXorNode | undefined;

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

    const result: PQP.Language.Type.TPowerQueryType | undefined = maybeNextXorNode
        ? await inspectXor(state, maybeNextXorNode)
        : undefined;

    trace.exit();

    return result;
}

// Recursively derefence an identifier if it points to another identifier.
export async function recursiveIdentifierDereference(state: InspectTypeState, xorNode: TXorNode): Promise<TXorNode> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        recursiveIdentifierDereference.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsIdentifier(xorNode);

    const result: TXorNode = Assert.asDefined(await recursiveIdentifierDereferenceHelper(state, xorNode));
    trace.exit();

    return result;
}

// Recursively derefence an identifier if it points to another identifier.
async function recursiveIdentifierDereferenceHelper(
    state: InspectTypeState,
    xorNode: TXorNode,
): Promise<TXorNode | undefined> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectXor.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsIdentifier(xorNode);

    if (XorNodeUtils.isContextXor(xorNode)) {
        trace.exit({ [TraceConstant.Result]: undefined });

        return undefined;
    }

    const identifier: Ast.Identifier | Ast.IdentifierExpression = xorNode.node;
    const identifierId: number = identifier.id;

    let identifierLiteral: string;
    let isRecursiveIdentifier: boolean;

    switch (identifier.kind) {
        case Ast.NodeKind.Identifier:
            identifierLiteral = identifier.literal;
            isRecursiveIdentifier = false;
            break;

        case Ast.NodeKind.IdentifierExpression:
            identifierLiteral = identifier.identifier.literal;
            isRecursiveIdentifier = identifier.maybeInclusiveConstant !== undefined;
            break;

        default:
            throw Assert.isNever(identifier);
    }

    const nodeScope: NodeScope = await assertGetOrCreateNodeScope(state, identifierId);

    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(
        isRecursiveIdentifier ? `@${identifierLiteral}` : identifierLiteral,
    );

    if (maybeScopeItem === undefined) {
        return xorNode;
    }

    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: TXorNode | undefined;

    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
        case ScopeItemKind.Parameter:
        case ScopeItemKind.Undefined:
            trace.exit({ [TraceConstant.Result]: scopeItem.kind });

            return xorNode;

        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        default:
            throw Assert.isNever(scopeItem);
    }

    const result: TXorNode | undefined =
        maybeNextXorNode !== undefined &&
        XorNodeUtils.isAstXorChecked<Ast.Identifier | Ast.IdentifierExpression>(maybeNextXorNode, [
            Ast.NodeKind.Identifier,
            Ast.NodeKind.IdentifierExpression,
        ])
            ? await recursiveIdentifierDereferenceHelper(state, maybeNextXorNode)
            : xorNode;

    trace.exit();

    return result;
}

export function createParameterType(parameter: ParameterScopeItem): Type.TPrimitiveType {
    if (parameter.maybeType === undefined) {
        return Type.NoneInstance;
    }

    return {
        kind: TypeUtils.typeKindFromPrimitiveTypeConstantKind(parameter.maybeType),
        maybeExtendedKind: undefined,
        isNullable: parameter.isNullable,
    };
}

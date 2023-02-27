// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ExternalType, ExternalTypeUtils } from "../../../externalType";
import { Inspection, InspectionTraceConstant, TraceUtils } from "../../..";
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
import { tryDeferenceIdentifier } from "../../deferenceIdentifier";
import { TypeById } from "../../typeCache";

// Drops PQP.LexSettings and PQP.ParseSettings as they're not needed.
export interface InspectTypeState
    extends PQP.CommonSettings,
        Omit<InspectionSettings, keyof PQP.LexSettings | keyof PQP.ParseSettings> {
    readonly typeById: TypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly scopeById: ScopeById;
}

// Recursively flattens all AnyUnion.unionedTypePairs into a single array,
// maps each entry into a boolean,
// then calls all(...) on the mapped values.
export function allForAnyUnion(anyUnion: Type.AnyUnion, predicate: (type: Type.TPowerQueryType) => boolean): boolean {
    return (
        anyUnion.unionedTypePairs
            .map((type: Type.TPowerQueryType) =>
                type.extendedKind === Type.ExtendedTypeKind.AnyUnion
                    ? allForAnyUnion(type, predicate)
                    : predicate(type),
            )
            .indexOf(false) === -1
    );
}

export async function assertGetOrCreateNodeScope(
    state: InspectTypeState,
    nodeId: number,
    correlationId: number | undefined,
): Promise<NodeScope> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        assertGetOrCreateNodeScope.name,
        correlationId,
    );

    state.cancellationToken?.throwIfCancelled();

    const triedGetOrCreateScope: Inspection.TriedNodeScope = await getOrCreateScope(state, nodeId, trace.id);

    if (ResultUtils.isError(triedGetOrCreateScope)) {
        trace.exit({ [TraceConstant.IsThrowing]: true });

        throw triedGetOrCreateScope.error;
    }

    trace.exit();

    return Assert.asDefined(triedGetOrCreateScope.value);
}

export async function getOrCreateScope(
    state: InspectTypeState,
    nodeId: number,
    correlationId: number | undefined,
): Promise<Inspection.TriedNodeScope> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        getOrCreateScope.name,
        correlationId,
    );

    const updatedState: InspectTypeState = {
        ...state,
        initialCorrelationId: trace.id,
    };

    state.cancellationToken?.throwIfCancelled();

    const nodeScope: NodeScope | undefined = updatedState.scopeById.get(nodeId);

    if (nodeScope !== undefined) {
        trace.exit();

        return ResultUtils.boxOk(nodeScope);
    }

    const result: Inspection.TriedNodeScope = await tryNodeScope(
        updatedState,
        state.nodeIdMapCollection,
        nodeId,
        state.scopeById,
    );

    trace.exit();

    return result;
}

export async function getOrCreateScopeItemType(
    state: InspectTypeState,
    scopeItem: TScopeItem,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScopeItem,
        getOrCreateScopeItemType.name,
        state.initialCorrelationId,
    );

    const nodeId: number = scopeItem.id;
    const type: Type.TPowerQueryType | undefined = state.typeById.get(nodeId);

    if (type !== undefined) {
        trace.exit({ cacheHit: true });

        return type;
    }

    const scopeType: Type.TPowerQueryType = await inspectScopeItem(state, scopeItem, trace.id);
    trace.exit();

    return scopeType;
}

export async function inspectScopeItem(
    state: InspectTypeState,
    scopeItem: TScopeItem,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    state.cancellationToken?.throwIfCancelled();

    switch (scopeItem.kind) {
        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            return scopeItem.value === undefined
                ? Type.UnknownInstance
                : await inspectXor(state, scopeItem.value, correlationId);

        case ScopeItemKind.Each:
            return await inspectXor(state, scopeItem.eachExpression, correlationId);

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
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeFromChildAttributeIndex.name,
        correlationId,
        TraceUtils.createXorNodeDetails(parentXorNode),
    );

    state.cancellationToken?.throwIfCancelled();

    const xorNode: TXorNode | undefined = PQP.Parser.NodeIdMapUtils.nthChild(
        state.nodeIdMapCollection,
        parentXorNode.node.id,
        attributeIndex,
    );

    const result: Type.TPowerQueryType =
        xorNode !== undefined ? await inspectXor(state, xorNode, trace.id) : Type.UnknownInstance;

    trace.exit();

    return result;
}

export async function inspectXor(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectXor.name,
        correlationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();

    const xorNodeId: number = xorNode.node.id;
    const cached: Type.TPowerQueryType | undefined = state.typeById.get(xorNodeId);

    if (cached !== undefined) {
        trace.exit();

        return Promise.resolve(cached);
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
            trace.exit();

            return Promise.resolve(Type.NotApplicableInstance);

        case Ast.NodeKind.AsType:
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.CatchExpression:
        case Ast.NodeKind.FieldTypeSpecification:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.TypePrimaryType:
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 1, trace.id);
            break;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = await inspectTypeTBinOpExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.SectionMember:
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 2, trace.id);
            break;

        case Ast.NodeKind.Csv:
        case Ast.NodeKind.MetadataExpression:
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 0, trace.id);
            break;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
            result = await inspectTypeList(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.NullablePrimitiveType:
            result = {
                ...(await inspectTypeFromChildAttributeIndex(state, xorNode, 1, trace.id)),
                isNullable: true,
            };

            break;

        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordExpression:
            result = await inspectTypeRecord(state, xorNode, trace.id);
            break;

        // TODO: how should error raising be typed?
        case Ast.NodeKind.ErrorRaisingExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.Constant:
            result = inspectTypeConstant(xorNode);
            break;

        case Ast.NodeKind.EachExpression:
            result = await inspectTypeEachExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.ErrorHandlingExpression:
            result = await inspectTypeErrorHandlingExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.FieldProjection:
            result = await inspectTypeFieldProjection(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.FieldSelector:
            result = await inspectTypeFieldSelector(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.FieldSpecification:
            result = await inspectTypeFieldSpecification(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.FunctionExpression:
            result = await inspectTypeFunctionExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.FunctionType:
            result = await inspectTypeFunctionType(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.Identifier:
            result = await inspectTypeIdentifier(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.IdentifierExpression:
            result = await inspectTypeIdentifierExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.IfExpression:
            result = await inspectTypeIfExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.IsExpression:
            result = Type.LogicalInstance;
            break;

        case Ast.NodeKind.InvokeExpression:
            result = await inspectTypeInvokeExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.IsNullablePrimitiveType:
            result = Type.LogicalInstance;
            break;

        case Ast.NodeKind.ItemAccessExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.LetExpression:
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 3, trace.id);
            break;

        case Ast.NodeKind.ListType:
            result = await inspectTypeListType(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.LiteralExpression:
            result = inspectTypeLiteralExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.NotImplementedExpression:
            result = Type.NoneInstance;
            break;

        case Ast.NodeKind.NullCoalescingExpression:
            result = await inspectTypeNullCoalescingExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.Parameter:
            result = await inspectTypeParameter(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.PrimitiveType:
            result = inspectTypePrimitiveType(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.RangeExpression:
            result = await inspectTypeRangeExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.RecordType:
            result = await inspectTypeRecordType(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            result = await inspectTypeRecursivePrimaryExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.TableType:
            result = await inspectTypeTableType(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.UnaryExpression:
            result = await inspectTypeUnaryExpression(state, xorNode, trace.id);
            break;

        default:
            throw Assert.isNever(xorNode.node);
    }

    state.typeById.set(xorNodeId, result);
    trace.exit({ resultKind: result.kind, extendedKind: result.extendedKind });

    return result;
}

export async function dereferencedIdentifierType(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType | undefined> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        dereferencedIdentifierType.name,
        correlationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();

    const updatedSettings: PQP.CommonSettings = {
        ...state,
        initialCorrelationId: trace.id,
    };

    const triedDeference: PQP.Result<TXorNode | undefined, PQP.CommonError.CommonError> = await tryDeferenceIdentifier(
        updatedSettings,
        state.nodeIdMapCollection,
        xorNode,
        state.scopeById,
    );

    if (ResultUtils.isError(triedDeference)) {
        trace.exit({ [TraceConstant.IsThrowing]: true });

        throw triedDeference.error;
    } else if (triedDeference.value === undefined) {
        trace.exit();

        return undefined;
    }

    const dereferencedLiteral: string | undefined = XorNodeUtils.identifierExpressionLiteral(triedDeference.value);

    if (dereferencedLiteral === undefined) {
        trace.exit();

        return undefined;
    }

    const deferencedLiteral: string = dereferencedLiteral;
    const nodeScope: NodeScope = await assertGetOrCreateNodeScope(state, triedDeference.value.node.id, trace.id);

    // When referencing an identifier as a recursive identifier there's no requirements
    // for it to resolve to a recursive reference.
    // This if it's a recursive identifier we need to also try the identifier without the recursive `@` prefix.
    let scopeItem: TScopeItem | undefined = nodeScope.get(deferencedLiteral);

    if (deferencedLiteral.startsWith("@") && scopeItem === undefined) {
        scopeItem = nodeScope.get(deferencedLiteral.slice(1));
    }

    // The deferenced identifier can't be resolved within the local scope.
    // It either is either an invalid identifier or an external identifier (e.g `Odbc.Database`).
    if (scopeItem === undefined) {
        const request: ExternalType.ExternalValueTypeRequest =
            ExternalTypeUtils.createValueTypeRequest(deferencedLiteral);

        const result: Type.TPowerQueryType | undefined = state.library.externalTypeResolver(request);
        trace.exit();

        return result;
    }

    let nextXorNode: TXorNode | undefined;

    switch (scopeItem.kind) {
        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            nextXorNode = scopeItem.value;
            break;

        case ScopeItemKind.Each:
            nextXorNode = scopeItem.eachExpression;
            break;

        case ScopeItemKind.Parameter:
            return createParameterType(scopeItem);

        case ScopeItemKind.Undefined:
            trace.exit();

            return undefined;

        default:
            throw Assert.isNever(scopeItem);
    }

    // Infinite recursion on an inclusive identifier.
    // There's no good way to handle the type of this as it requires evaluation, so mark it as any.
    if (deferencedLiteral.startsWith("@") && nextXorNode?.node.id === xorNode.node.id) {
        return Type.AnyInstance;
    }

    const result: PQP.Language.Type.TPowerQueryType | undefined = nextXorNode
        ? await inspectXor(state, nextXorNode, trace.id)
        : undefined;

    trace.exit();

    return result;
}

export function createParameterType(parameter: ParameterScopeItem): Type.TPrimitiveType {
    return {
        kind: parameter.type ? TypeUtils.typeKindFromPrimitiveTypeConstantKind(parameter.type) : Type.TypeKind.Any,
        extendedKind: undefined,
        isNullable: parameter.isNullable || parameter.isOptional,
    };
}

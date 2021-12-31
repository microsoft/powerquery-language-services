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
import { TypeById } from "../../typeCache";

export interface InspectTypeState extends PQP.CommonSettings, Pick<InspectionSettings, "maybeExternalTypeResolver"> {
    // readonly settings: InspectionSettings;
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
            .map((type: Type.TPowerQueryType) => {
                return type.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion
                    ? allForAnyUnion(type, conditionFn)
                    : conditionFn(type);
            })
            .indexOf(false) === -1
    );
}

export function assertGetOrCreateNodeScope(state: InspectTypeState, nodeId: number): NodeScope {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedGetOrCreateScope: Inspection.TriedNodeScope = getOrCreateScope(state, nodeId);
    if (ResultUtils.isError(triedGetOrCreateScope)) {
        throw triedGetOrCreateScope;
    }

    return Assert.asDefined(triedGetOrCreateScope.value);
}

export function getOrCreateScope(state: InspectTypeState, nodeId: number): Inspection.TriedNodeScope {
    state.maybeCancellationToken?.throwIfCancelled();

    const maybeNodeScope: NodeScope | undefined = state.scopeById.get(nodeId);
    if (maybeNodeScope !== undefined) {
        return ResultUtils.boxOk(maybeNodeScope);
    }

    return tryNodeScope(state, state.nodeIdMapCollection, nodeId, state.scopeById);
}

export function getOrCreateScopeItemType(state: InspectTypeState, scopeItem: TScopeItem): Type.TPowerQueryType {
    const nodeId: number = scopeItem.id;

    const maybeGivenType: Type.TPowerQueryType | undefined = state.givenTypeById.get(nodeId);
    if (maybeGivenType !== undefined) {
        return maybeGivenType;
    }

    const maybeDeltaType: Type.TPowerQueryType | undefined = state.givenTypeById.get(nodeId);
    if (maybeDeltaType !== undefined) {
        return maybeDeltaType;
    }

    const scopeType: Type.TPowerQueryType = inspectScopeItem(state, scopeItem);
    return scopeType;
}

export function inspectScopeItem(state: InspectTypeState, scopeItem: TScopeItem): Type.TPowerQueryType {
    state.maybeCancellationToken?.throwIfCancelled();

    switch (scopeItem.kind) {
        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            return scopeItem.maybeValue === undefined ? Type.UnknownInstance : inspectXor(state, scopeItem.maybeValue);

        case ScopeItemKind.Each:
            return inspectXor(state, scopeItem.eachExpression);

        case ScopeItemKind.Parameter:
            return createParameterType(scopeItem);

        case ScopeItemKind.Undefined:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(scopeItem);
    }
}

export function inspectTypeFromChildAttributeIndex(
    state: InspectTypeState,
    parentXorNode: TXorNode,
    attributeIndex: number,
): Type.TPowerQueryType {
    state.maybeCancellationToken?.throwIfCancelled();

    const maybeXorNode: TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeNthChild(
        state.nodeIdMapCollection,
        parentXorNode.node.id,
        attributeIndex,
    );
    return maybeXorNode !== undefined ? inspectXor(state, maybeXorNode) : Type.UnknownInstance;
}

export function inspectXor(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
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
        return maybeCached;
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
            return Type.NotApplicableInstance;

        case Ast.NodeKind.AsType:
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.FieldTypeSpecification:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.ParenthesizedExpression:
        case Ast.NodeKind.TypePrimaryType:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 1);
            break;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = inspectTypeTBinOpExpression(state, xorNode);
            break;

        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.SectionMember:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 2);
            break;

        case Ast.NodeKind.Csv:
        case Ast.NodeKind.MetadataExpression:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
            break;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
            result = inspectTypeList(state, xorNode);
            break;

        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.NullablePrimitiveType:
            result = {
                ...inspectTypeFromChildAttributeIndex(state, xorNode, 1),
                isNullable: true,
            };
            break;

        case Ast.NodeKind.RecordLiteral:
        case Ast.NodeKind.RecordExpression:
            result = inspectTypeRecord(state, xorNode);
            break;

        // TODO: how should error raising be typed?
        case Ast.NodeKind.ErrorRaisingExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.Constant:
            result = inspectTypeConstant(xorNode);
            break;

        case Ast.NodeKind.EachExpression:
            result = inspectTypeEachExpression(state, xorNode);
            break;

        case Ast.NodeKind.ErrorHandlingExpression:
            result = inspectTypeErrorHandlingExpression(state, xorNode);
            break;

        case Ast.NodeKind.FieldProjection:
            result = inspectTypeFieldProjection(state, xorNode);
            break;

        case Ast.NodeKind.FieldSelector:
            result = inspectTypeFieldSelector(state, xorNode);
            break;

        case Ast.NodeKind.FieldSpecification:
            result = inspectTypeFieldSpecification(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            result = inspectTypeFunctionExpression(state, xorNode);
            break;

        case Ast.NodeKind.FunctionType:
            result = inspectTypeFunctionType(state, xorNode);
            break;

        case Ast.NodeKind.Identifier:
            result = inspectTypeIdentifier(state, xorNode);
            break;

        case Ast.NodeKind.IdentifierExpression:
            result = inspectTypeIdentifierExpression(state, xorNode);
            break;

        case Ast.NodeKind.IfExpression:
            result = inspectTypeIfExpression(state, xorNode);
            break;

        case Ast.NodeKind.IsExpression:
            result = TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical);
            break;

        case Ast.NodeKind.InvokeExpression:
            result = inspectTypeInvokeExpression(state, xorNode);
            break;

        case Ast.NodeKind.IsNullablePrimitiveType:
            result = TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical);
            break;

        case Ast.NodeKind.ItemAccessExpression:
            result = Type.AnyInstance;
            break;

        case Ast.NodeKind.LetExpression:
            result = inspectTypeFromChildAttributeIndex(state, xorNode, 3);
            break;

        case Ast.NodeKind.ListType:
            result = inspectTypeListType(state, xorNode);
            break;

        case Ast.NodeKind.LiteralExpression:
            result = inspectTypeLiteralExpression(state, xorNode);
            break;

        case Ast.NodeKind.NotImplementedExpression:
            result = Type.NoneInstance;
            break;

        case Ast.NodeKind.NullCoalescingExpression:
            result = inspectTypeNullCoalescingExpression(state, xorNode);
            break;

        case Ast.NodeKind.Parameter:
            result = inspectTypeParameter(state, xorNode);
            break;

        case Ast.NodeKind.PrimitiveType:
            result = inspectTypePrimitiveType(state, xorNode);
            break;

        case Ast.NodeKind.RangeExpression:
            result = inspectTypeRangeExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordType:
            result = inspectTypeRecordType(state, xorNode);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            result = inspectTypeRecursivePrimaryExpression(state, xorNode);
            break;

        case Ast.NodeKind.TableType:
            result = inspectTypeTableType(state, xorNode);
            break;

        case Ast.NodeKind.UnaryExpression:
            result = inspectTypeUnaryExpression(state, xorNode);
            break;

        default:
            throw Assert.isNever(xorNode.node);
    }

    state.deltaTypeById.set(xorNodeId, result);
    trace.exit({ resultKind: result.kind, maybeResultExtendedKind: result.maybeExtendedKind });

    return result;
}

export function maybeDereferencedIdentifierType(
    state: InspectTypeState,
    xorNode: TXorNode,
): Type.TPowerQueryType | undefined {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        maybeDereferencedIdentifierType.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );
    state.maybeCancellationToken?.throwIfCancelled();

    const deferenced: TXorNode = recursiveIdentifierDereference(state, xorNode);

    const maybeDereferencedLiteral: string | undefined = XorNodeUtils.maybeIdentifierExpressionLiteral(deferenced);
    if (maybeDereferencedLiteral === undefined) {
        return undefined;
    }
    const deferencedLiteral: string = maybeDereferencedLiteral;

    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, deferenced.node.id);
    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(deferencedLiteral);
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
        ? inspectXor(state, maybeNextXorNode)
        : undefined;
    trace.exit();

    return result;
}

// Recursively derefence an identifier if it points to another identifier.
export function recursiveIdentifierDereference(state: InspectTypeState, xorNode: TXorNode): TXorNode {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectXor.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );
    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsIdentifier(xorNode);

    const result: TXorNode = Assert.asDefined(recursiveIdentifierDereferenceHelper(state, xorNode));
    trace.exit();

    return result;
}

// Recursively derefence an identifier if it points to another identifier.
function recursiveIdentifierDereferenceHelper(state: InspectTypeState, xorNode: TXorNode): TXorNode | undefined {
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

    // TODO: handle recursive identifiers
    if (isRecursiveIdentifier === true) {
        trace.exit({ [TraceConstant.Result]: "recursive identifier" });

        return xorNode;
    }

    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, identifierId);

    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(identifierLiteral);
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

    return maybeNextXorNode !== undefined &&
        XorNodeUtils.isAstXorChecked<Ast.Identifier | Ast.IdentifierExpression>(maybeNextXorNode, [
            Ast.NodeKind.Identifier,
            Ast.NodeKind.IdentifierExpression,
        ])
        ? recursiveIdentifierDereferenceHelper(state, maybeNextXorNode)
        : xorNode;
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

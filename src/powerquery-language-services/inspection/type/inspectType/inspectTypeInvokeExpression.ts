// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Keyword, TextUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { DereferencedIdentifierKind, TDereferencedIdentifier } from "../../dereferencedIdentifier";
import { ExternalType, ExternalTypeUtils } from "../../../externalType";
import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, InspectTypeStateUtils } from "./inspectTypeState";
import { inspectXor } from "./common";
import { tryBuildDereferencedIdentifierPath } from "../../dereferencedIdentifier/dereferencedIdentifierUtils";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeInvokeExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression);

    const intrinsicType: Type.TPowerQueryType | undefined = await inspectIntrinsicInvokeExpression(
        state,
        xorNode,
        trace.id,
    );

    if (intrinsicType !== undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(intrinsicType) });

        return intrinsicType;
    }

    const request: ExternalType.ExternalInvocationTypeRequest | undefined = await externalInvokeRequest(
        state,
        xorNode,
        trace.id,
    );

    if (request !== undefined) {
        const type: Type.TPowerQueryType | undefined = state.library.externalTypeResolver(request);

        if (type !== undefined) {
            trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(type) });

            return type;
        }
    }

    const previousSibling: TXorNode = NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    const previousSiblingType: Type.TPowerQueryType = await inspectXor(state, previousSibling, trace.id);

    let result: Type.TPowerQueryType;

    if (previousSiblingType.kind === Type.TypeKind.Any) {
        result = Type.AnyInstance;
    } else if (previousSiblingType.kind !== Type.TypeKind.Function) {
        result = Type.NoneInstance;
    } else if (previousSiblingType.extendedKind === Type.ExtendedTypeKind.DefinedFunction) {
        result = previousSiblingType.returnType;
    } else {
        result = Type.AnyInstance;
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

async function inspectIntrinsicInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType | undefined> {
    const identifier: XorNode<Ast.IdentifierExpression> | undefined = NodeIdMapUtils.invokeExpressionIdentifier(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    if (
        identifier === undefined ||
        XorNodeUtils.isContext(identifier) ||
        identifier.node.identifier.literal !== Keyword.KeywordKind.HashTable
    ) {
        return undefined;
    }

    if (state.typeStrategy === TypeStrategy.Primitive) {
        return Type.TableInstance;
    }

    const [columns]: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterInvokeExpression(
        state.nodeIdMapCollection,
        XorNodeUtils.assertAsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression),
    );

    if (columns === undefined) {
        return Type.TableInstance;
    }

    return definedTableFromColumnsType(await inspectXor(state, columns, correlationId));
}

function definedTableFromColumnsType(columnsType: Type.TPowerQueryType): Type.Table | Type.DefinedTable {
    if (columnsType.extendedKind === Type.ExtendedTypeKind.TableType) {
        return TypeUtils.definedTable(false, new PQP.OrderedMap(columnsType.fields), columnsType.isOpen);
    }

    if (columnsType.extendedKind !== Type.ExtendedTypeKind.DefinedList) {
        return Type.TableInstance;
    }

    const fields: Map<string, Type.TPowerQueryType> = new Map();

    for (const element of columnsType.elements) {
        if (element.extendedKind !== Type.ExtendedTypeKind.TextLiteral) {
            return Type.TableInstance;
        }

        const fieldName: string = TextUtils.unescape(element.literal.slice(1, -1));

        if (fields.has(fieldName)) {
            return Type.TableInstance;
        }

        fields.set(fieldName, Type.AnyInstance);
    }

    return TypeUtils.definedTable(false, new PQP.OrderedMap(fields), false);
}

async function externalInvokeRequest(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<ExternalType.ExternalInvocationTypeRequest | undefined> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        externalInvokeRequest.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    const identifier: XorNode<Ast.IdentifierExpression> | undefined = NodeIdMapUtils.invokeExpressionIdentifier(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    if (identifier === undefined) {
        trace.exit();

        return undefined;
    }

    const triedDereferencedIdentifier: PQP.Result<
        ReadonlyArray<TDereferencedIdentifier>,
        PQP.CommonError.CommonError
    > = await tryBuildDereferencedIdentifierPath(
        InspectTypeStateUtils.toInspectionSettings(state, trace),
        state.nodeIdMapCollection,
        identifier,
        state.scopeById,
    );

    if (ResultUtils.isError(triedDereferencedIdentifier) || triedDereferencedIdentifier.value === undefined) {
        return undefined;
    }

    const endOfPath: TDereferencedIdentifier = Assert.asDefined(
        triedDereferencedIdentifier.value[triedDereferencedIdentifier.value.length - 1],
    );

    if (endOfPath.kind !== DereferencedIdentifierKind.External) {
        return undefined;
    }

    const types: Type.TPowerQueryType[] = [];

    for (const argument of NodeIdMapIterator.iterInvokeExpression(
        state.nodeIdMapCollection,
        XorNodeUtils.assertAsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression),
    )) {
        // eslint-disable-next-line no-await-in-loop
        types.push(await inspectXor(state, argument, trace.id));
    }

    const result: ExternalType.ExternalInvocationTypeRequest = ExternalTypeUtils.invocationTypeRequest(
        endOfPath.identifierLiteral,
        types,
    );

    trace.exit();

    return result;
}

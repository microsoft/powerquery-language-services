// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { assertGetOrCreateNodeScope, NodeScope, ScopeById, ScopeItemKind, TScopeItem } from "./scope";
import { Inspection, TraceUtils } from "..";
import { InspectionTraceConstant } from "../trace";

// Recusrive deference of the identifier until it reaches the value node.
// Does not handle recursive identifiers.
export async function tryDeferenceIdentifier(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    // If a map is given, then it's mutated and returned.
    // Else create a new Map instance and return that instead.
    scopeById: ScopeById = new Map(),
): Promise<PQP.Result<TXorNode | undefined, PQP.CommonError.CommonError>> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        tryDeferenceIdentifier.name,
        settings.initialCorrelationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    const updatedSettings: PQP.CommonSettings = {
        ...settings,
        initialCorrelationId: trace.id,
    };

    XorNodeUtils.assertIsIdentifier(xorNode);

    if (XorNodeUtils.isContextXor(xorNode)) {
        trace.exit({ [TraceConstant.Result]: undefined });

        return ResultUtils.ok(undefined);
    }

    const identifier: Ast.Identifier | Ast.IdentifierExpression = xorNode.node as
        | Ast.Identifier
        | Ast.IdentifierExpression;

    let identifierLiteral: string;

    switch (identifier.kind) {
        case Ast.NodeKind.Identifier:
            identifierLiteral = identifier.literal;
            break;

        case Ast.NodeKind.IdentifierExpression:
            identifierLiteral = identifier.identifier.literal;
            break;

        default:
            throw Assert.isNever(identifier);
    }

    const triedNodeScope: Inspection.TriedNodeScope = await assertGetOrCreateNodeScope(
        updatedSettings,
        nodeIdMapCollection,
        xorNode.node.id,
        scopeById,
    );

    if (ResultUtils.isError(triedNodeScope)) {
        trace.exit({ [TraceConstant.Result]: triedNodeScope.kind });

        return triedNodeScope;
    }

    const nodeScope: NodeScope = triedNodeScope.value;
    const scopeItem: TScopeItem | undefined = nodeScope.get(identifierLiteral);

    if (
        // If the identifier couldn't be found in the generated scope,
        // then either the scope generation is incorrect or it's an external identifier.
        scopeItem === undefined
    ) {
        trace.exit({ [TraceConstant.Result]: undefined });

        return ResultUtils.ok(xorNode);
    }

    let nextXorNode: TXorNode | undefined;

    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
        case ScopeItemKind.Parameter:
        case ScopeItemKind.Undefined:
            break;

        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
            nextXorNode = scopeItem.value;
            break;

        case ScopeItemKind.SectionMember:
            nextXorNode = scopeItem.value;
            break;

        default:
            throw Assert.isNever(scopeItem);
    }

    let result: Promise<PQP.Result<TXorNode | undefined, PQP.CommonError.CommonError>>;

    if (nextXorNode === undefined) {
        result = Promise.resolve(ResultUtils.ok(xorNode));
    } else if (
        XorNodeUtils.isContextXor(nextXorNode) ||
        (nextXorNode.node.kind !== Ast.NodeKind.Identifier &&
            nextXorNode.node.kind !== Ast.NodeKind.IdentifierExpression)
    ) {
        result = Promise.resolve(ResultUtils.ok(xorNode));
    } else {
        result = tryDeferenceIdentifier(updatedSettings, nodeIdMapCollection, nextXorNode, scopeById);
    }

    trace.exit();

    return result;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { NodeIdMap, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { Position } from "vscode-languageserver-types";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";
import { TriedExpectedType, tryExpectedType } from "./expectedType";
import { TriedNodeScope, tryNodeScope } from "./scope";
import { TriedScopeType, tryScopeType } from "./type";
import { TypeCache, TypeCacheUtils } from "./typeCache";
import { autocomplete } from "./autocomplete";
import { Inspected } from "./commonTypes";
import { InspectionSettings } from "../inspectionSettings";
import { TriedCurrentInvokeExpression } from "./invokeExpression";
import { tryCurrentInvokeExpression } from "./invokeExpression/currentInvokeExpression";

export async function inspect(
    settings: InspectionSettings,
    parseState: PQP.Parser.ParseState,
    maybeParseError: PQP.Parser.ParseError.ParseError | undefined,
    position: Position,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Promise<Inspected> {
    const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;

    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(nodeIdMapCollection, position);

    const triedCurrentInvokeExpression: Promise<TriedCurrentInvokeExpression> = tryCurrentInvokeExpression(
        settings,
        nodeIdMapCollection,
        maybeActiveNode,
        typeCache,
    );

    let triedNodeScope: Promise<TriedNodeScope>;
    let triedScopeType: Promise<TriedScopeType>;
    let triedExpectedType: TriedExpectedType;

    if (ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        const activeNode: ActiveNode = maybeActiveNode;

        triedNodeScope = tryNodeScope(
            settings,
            nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            typeCache.scopeById,
        );

        const ancestryLeaf: TXorNode = PQP.Parser.AncestryUtils.assertGetLeaf(activeNode.ancestry);
        triedScopeType = tryScopeType(settings, nodeIdMapCollection, ancestryLeaf.node.id, typeCache);

        triedExpectedType = tryExpectedType(settings, activeNode);
    } else {
        triedNodeScope = Promise.resolve(PQP.ResultUtils.boxOk(new Map()));
        triedScopeType = Promise.resolve(PQP.ResultUtils.boxOk(new Map()));
        triedExpectedType = PQP.ResultUtils.boxOk(undefined);
    }

    return {
        maybeActiveNode,
        autocomplete: await autocomplete(settings, parseState, typeCache, maybeActiveNode, maybeParseError),
        triedCurrentInvokeExpression,
        triedNodeScope,
        triedScopeType,
        triedExpectedType,
        typeCache,
        parseState,
    };
}

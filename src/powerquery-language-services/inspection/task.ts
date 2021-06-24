// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { Position } from "vscode-languageserver-types";

import { InspectionSettings } from "../inspectionSettings";
import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";
import { autocomplete } from "./autocomplete";
import { Inspection } from "./commonTypes";
import { TriedExpectedType, tryExpectedType } from "./expectedType";
import { TriedCurrentInvokeExpression } from "./invokeExpression";
import { tryCurrentInvokeExpression } from "./invokeExpression/currentInvokeExpression";
import { TriedNodeScope, tryNodeScope } from "./scope";
import { TriedScopeType, tryScopeType } from "./type";
import { TypeCache, TypeCacheUtils } from "./typeCache";

export function inspection(
    settings: InspectionSettings,
    parseState: PQP.Parser.ParseState,
    maybeParseError: PQP.Parser.ParseError.ParseError | undefined,
    position: Position,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Inspection {
    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;

    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(nodeIdMapCollection, position);

    const triedCurrentInvokeExpression: TriedCurrentInvokeExpression = tryCurrentInvokeExpression(
        settings,
        nodeIdMapCollection,
        maybeActiveNode,
        typeCache,
    );

    let triedNodeScope: TriedNodeScope;
    let triedScopeType: TriedScopeType;
    let triedExpectedType: TriedExpectedType;
    if (ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        const activeNode: ActiveNode = maybeActiveNode;

        triedNodeScope = tryNodeScope(
            settings,
            nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            typeCache.scopeById,
        );

        const ancestryLeaf: PQP.Parser.TXorNode = PQP.Parser.AncestryUtils.assertGetLeaf(activeNode.ancestry);
        triedScopeType = tryScopeType(settings, nodeIdMapCollection, ancestryLeaf.node.id, typeCache);

        triedExpectedType = tryExpectedType(settings, activeNode);
    } else {
        triedNodeScope = PQP.ResultUtils.createOk(new Map());
        triedScopeType = PQP.ResultUtils.createOk(new Map());
        triedExpectedType = PQP.ResultUtils.createOk(undefined);
    }

    return {
        maybeActiveNode,
        autocomplete: autocomplete(settings, parseState, typeCache, maybeActiveNode, maybeParseError),
        triedCurrentInvokeExpression,
        triedNodeScope,
        triedScopeType,
        triedExpectedType,
    };
}

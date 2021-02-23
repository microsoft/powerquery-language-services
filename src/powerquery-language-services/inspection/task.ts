// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";
import { autocomplete } from "./autocomplete";
import { Inspection } from "./commonTypes";
import { TriedExpectedType, tryExpectedType } from "./expectedType";
import { TriedInvokeExpression, tryInvokeExpression } from "./invokeExpression";
import { Position } from "./position";
import { TriedNodeScope, tryNodeScope } from "./scope";
import { InspectionSettings } from "./settings";
import { TriedScopeType, tryScopeType } from "./type";
import { createTypeCache, TypeCache } from "./typeCache";

export function inspection<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.ParseSettings<S> & InspectionSettings,
    parseState: S,
    maybeParseError: PQP.Parser.ParseError.ParseError<S> | undefined,
    position: Position,
): Inspection {
    const typeCache: TypeCache = createTypeCache();
    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseState.contextState.leafNodeIds;

    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );

    const triedInvokeExpression: TriedInvokeExpression = tryInvokeExpression(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
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
            leafNodeIds,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            typeCache.scopeById,
        );

        const ancestryLeaf: PQP.Parser.TXorNode = PQP.Parser.AncestryUtils.assertGetLeaf(activeNode.ancestry);
        triedScopeType = tryScopeType(settings, nodeIdMapCollection, leafNodeIds, ancestryLeaf.node.id, typeCache);

        triedExpectedType = tryExpectedType(settings, activeNode);
    } else {
        triedNodeScope = PQP.ResultUtils.okFactory(new Map());
        triedScopeType = PQP.ResultUtils.okFactory(new Map());
        triedExpectedType = PQP.ResultUtils.okFactory(undefined);
    }

    return {
        maybeActiveNode,
        autocomplete: autocomplete(settings, parseState, typeCache, maybeActiveNode, maybeParseError),
        triedInvokeExpression,
        triedNodeScope,
        triedScopeType,
        triedExpectedType,
    };
}
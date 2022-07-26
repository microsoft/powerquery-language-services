// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { Position } from "vscode-languageserver-types";

import {
    ActiveNodeUtils,
    Autocomplete,
    TMaybeActiveNode,
    TriedCurrentInvokeExpression,
    TriedNodeScope,
    TriedScopeType,
} from "../inspection";
import { AnalysisBase } from "./analysisBase";

export class MemoizedAnalysis extends AnalysisBase {
    private readonly activeNodeCache: Map<string, TMaybeActiveNode | undefined> = new Map();
    private readonly autocompleteCache: Map<number | undefined, Promise<Autocomplete | undefined>> = new Map();
    private readonly currentInvokeExpressionCache: Map<string, Promise<TriedCurrentInvokeExpression | undefined>> =
        new Map();
    private readonly nodeScopeCache: Map<number | undefined, Promise<TriedNodeScope | undefined>> = new Map();
    private readonly scopeTypeCache: Map<number | undefined, Promise<TriedScopeType | undefined>> = new Map();

    public dispose(): void {
        this.activeNodeCache.clear();
        this.autocompleteCache.clear();
        this.currentInvokeExpressionCache.clear();
        this.nodeScopeCache.clear();
        this.scopeTypeCache.clear();
    }

    protected override async getActiveNode(position: Position): Promise<TMaybeActiveNode | undefined> {
        const cacheKey: string = `${position.line}:${position.character}`;
        const maybeResult: TMaybeActiveNode | undefined = this.activeNodeCache.get(cacheKey);

        if (maybeResult !== undefined) {
            return Promise.resolve(maybeResult);
        }

        const result: TMaybeActiveNode | undefined = await super.getActiveNode(position);
        this.activeNodeCache.set(cacheKey, result);

        return Promise.resolve(result);
    }

    protected override inspectAutocomplete(
        activeNode: TMaybeActiveNode,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<Autocomplete | undefined> {
        return this.getOrCreate(
            this.autocompleteCache,
            () => (ActiveNodeUtils.isPositionInBounds(activeNode) ? activeNode.ancestry[0]?.node.id : undefined),
            () => super.inspectAutocomplete(activeNode, correlationId, cancellationToken),
        );
    }

    protected override inspectCurrentInvokeExpression(
        position: Position,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<TriedCurrentInvokeExpression | undefined> {
        return this.getOrCreate<string, TriedCurrentInvokeExpression | undefined>(
            this.currentInvokeExpressionCache,
            () => `${position.line}:${position.character}`,
            () => super.inspectCurrentInvokeExpression(position, correlationId, cancellationToken),
        );
    }

    protected override inspectNodeScope(
        activeNode: TMaybeActiveNode,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<TriedNodeScope | undefined> {
        return this.getOrCreate<number | undefined, TriedNodeScope | undefined>(
            this.nodeScopeCache,
            () => (ActiveNodeUtils.isPositionInBounds(activeNode) ? activeNode.ancestry[0]?.node.id : undefined),
            () => super.inspectNodeScope(activeNode, correlationId, cancellationToken),
        );
    }

    protected override inspectScopeType(
        activeNode: TMaybeActiveNode,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<TriedScopeType | undefined> {
        return this.getOrCreate(
            this.scopeTypeCache,
            () => (ActiveNodeUtils.isPositionInBounds(activeNode) ? activeNode.ancestry[0]?.node.id : undefined),
            () => super.inspectScopeType(activeNode, correlationId, cancellationToken),
        );
    }

    private async getOrCreate<K, V>(
        cache: Map<K, Promise<V>>,
        createCacheKeyFn: () => K,
        createValueFn: () => Promise<V>,
    ): Promise<V> {
        const cacheKey: K = createCacheKeyFn();
        const maybeResult: Promise<V> | undefined = cache.get(cacheKey);

        if (maybeResult !== undefined) {
            return await maybeResult;
        }

        const result: Promise<V> = createValueFn();
        cache.set(cacheKey, result);

        return result;
    }
}

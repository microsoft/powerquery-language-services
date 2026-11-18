// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, ICancellationToken, Result } from "@microsoft/powerquery-parser";
import { Position } from "vscode-languageserver-types";

import {
    ActiveNodeUtils,
    Autocomplete,
    TActiveNode,
    TriedCurrentInvokeExpression,
    TriedNodeScope,
    TriedScopeType,
} from "../inspection";
import { AnalysisBase } from "./analysisBase";

// Adds caching to AnalysisBase.
export class MemoizedAnalysis extends AnalysisBase {
    private readonly activeNodeCache: Map<string, Promise<Result<TActiveNode | undefined, CommonError.CommonError>>> =
        new Map();
    private readonly autocompleteCache: Map<number | undefined, Promise<Autocomplete | undefined>> = new Map();
    private readonly currentInvokeExpressionCache: Map<string, Promise<TriedCurrentInvokeExpression | undefined>> =
        new Map();
    private readonly nodeScopeCache: Map<number | undefined, Promise<TriedNodeScope | undefined>> = new Map();
    private readonly scopeTypeCache: Map<number | undefined, Promise<TriedScopeType | undefined>> = new Map();

    public override dispose(): void {
        this.activeNodeCache.clear();
        this.autocompleteCache.clear();
        this.currentInvokeExpressionCache.clear();
        this.nodeScopeCache.clear();
        this.scopeTypeCache.clear();

        super.dispose();
    }

    public override getActiveNode(
        position: Position,
    ): Promise<Result<TActiveNode | undefined, CommonError.CommonError>> {
        return this.getOrCreate<string, Result<TActiveNode | undefined, CommonError.CommonError>>(
            this.activeNodeCache,
            () => `${position.line}:${position.character}`,
            () => super.getActiveNode(position),
        );
    }

    protected override inspectAutocomplete(
        activeNode: TActiveNode,
        correlationId: number,
        cancellationToken?: ICancellationToken,
    ): Promise<Autocomplete | undefined> {
        return this.getOrCreate(
            this.autocompleteCache,
            () => (ActiveNodeUtils.isPositionInBounds(activeNode) ? activeNode.ancestry[0]?.node?.id : undefined),
            () => super.inspectAutocomplete(activeNode, correlationId, cancellationToken),
        );
    }

    protected override inspectCurrentInvokeExpression(
        position: Position,
        correlationId: number,
        cancellationToken?: ICancellationToken,
    ): Promise<TriedCurrentInvokeExpression | undefined> {
        return this.getOrCreate<string, TriedCurrentInvokeExpression | undefined>(
            this.currentInvokeExpressionCache,
            () => `${position.line}:${position.character}`,
            () => super.inspectCurrentInvokeExpression(position, correlationId, cancellationToken),
        );
    }

    protected override inspectNodeScope(
        activeNode: TActiveNode,
        correlationId: number,
        cancellationToken?: ICancellationToken,
    ): Promise<TriedNodeScope | undefined> {
        return this.getOrCreate<number | undefined, TriedNodeScope | undefined>(
            this.nodeScopeCache,
            () => (ActiveNodeUtils.isPositionInBounds(activeNode) ? activeNode.ancestry[0]?.node?.id : undefined),
            () => super.inspectNodeScope(activeNode, correlationId, cancellationToken),
        );
    }

    protected override inspectScopeType(
        activeNode: TActiveNode,
        correlationId: number,
        cancellationToken?: ICancellationToken,
    ): Promise<TriedScopeType | undefined> {
        return this.getOrCreate(
            this.scopeTypeCache,
            () => (ActiveNodeUtils.isPositionInBounds(activeNode) ? activeNode.ancestry[0]?.node?.id : undefined),
            () => super.inspectScopeType(activeNode, correlationId, cancellationToken),
        );
    }

    // Assumes the first call to getOrCreate will create the cache entry,
    // and any subsequent calls will return the cached value.
    private async getOrCreate<Key, Value>(
        cache: Map<Key, Promise<Value>>,
        cacheKeyFactory: () => Key,
        valueFactory: () => Promise<Value>,
    ): Promise<Value> {
        const cacheKey: Key = cacheKeyFactory();
        let result: Promise<Value> | undefined = cache.get(cacheKey);

        if (result !== undefined) {
            return await result;
        }

        result = valueFactory();
        cache.set(cacheKey, result);

        return result;
    }
}

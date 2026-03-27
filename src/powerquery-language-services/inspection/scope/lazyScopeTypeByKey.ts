// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { NodeScope, ScopeTypeByKey, TScopeItem } from "./scope";

// Type for the async resolver function
type ScopeItemTypeResolver = (scopeItem: TScopeItem) => Promise<Type.TPowerQueryType>;

/**
 * A lazy implementation of ScopeTypeByKey that defers type resolution until types are actually accessed.
 *
 * Types are resolved on-demand via the async `resolveType(key)` method.
 * Call `resolveAll()` to eagerly resolve all types and get a ReadonlyMap.
 */
export class LazyScopeTypeByKey extends ScopeTypeByKey {
    private readonly resolved: Map<string, Type.TPowerQueryType> = new Map();
    private readonly nodeScope: NodeScope;
    private readonly resolver: ScopeItemTypeResolver;

    constructor(nodeScope: NodeScope, resolver: ScopeItemTypeResolver) {
        super();
        this.nodeScope = nodeScope;
        this.resolver = resolver;
    }

    /** Returns true if the key exists in the scope (regardless of whether the type has been resolved). */
    override has(key: string): boolean {
        return this.nodeScope.scopeItemByKey.has(key);
    }

    /** Returns the scope keys (all identifiers in scope, not just resolved). */
    override keys(): IterableIterator<string> {
        return this.nodeScope.scopeItemByKey.keys();
    }

    /** Returns the total number of scope items (not just resolved ones). */
    override get size(): number {
        return this.nodeScope.scopeItemByKey.size;
    }

    /** Returns the number of scope items whose types have been resolved so far. */
    get resolvedSize(): number {
        return this.resolved.size;
    }

    /**
     * Asynchronously resolves the type for a specific key. Returns undefined if key not in scope.
     * Note: If the resolver throws, the error propagates to the caller uncaught.
     * The failed key is not cached, so a subsequent call will retry resolution.
     */
    override async resolveType(key: string): Promise<Type.TPowerQueryType | undefined> {
        // Return cached value if already resolved
        const cached: Type.TPowerQueryType | undefined = this.resolved.get(key);

        if (cached !== undefined) {
            return cached;
        }

        const scopeItem: TScopeItem | undefined = this.nodeScope.scopeItemByKey.get(key);

        if (scopeItem === undefined) {
            return undefined;
        }

        const type: Type.TPowerQueryType = await this.resolver(scopeItem);
        this.resolved.set(key, type);

        return type;
    }

    /** Resolves all scope item types. Returns a fully-populated read-only map. */
    override async resolveAll(): Promise<ReadonlyMap<string, Type.TPowerQueryType>> {
        const typesToResolve: Array<[string, TScopeItem]> = [];

        for (const [key, scopeItem] of this.nodeScope.scopeItemByKey.entries()) {
            if (!this.resolved.has(key)) {
                typesToResolve.push([key, scopeItem]);
            }
        }

        const resolvedTypes: Type.TPowerQueryType[] = await Promise.all(
            typesToResolve.map(([, scopeItem]: [string, TScopeItem]) => this.resolver(scopeItem)),
        );

        for (let index: number = 0; index < typesToResolve.length; index += 1) {
            this.resolved.set(typesToResolve[index][0], resolvedTypes[index]);
        }

        return this.resolved;
    }

    /** Resolves all types, then returns an iterator of [key, type] pairs. */
    override async entries(): Promise<IterableIterator<[string, Type.TPowerQueryType]>> {
        return (await this.resolveAll()).entries();
    }

    /** Resolves all types, then returns an iterator of types. */
    override async values(): Promise<IterableIterator<Type.TPowerQueryType>> {
        return (await this.resolveAll()).values();
    }

    /** Resolves all types, then calls the callback for each entry. */
    override async forEach(callbackfn: (value: Type.TPowerQueryType, key: string) => void): Promise<void> {
        return (await this.resolveAll()).forEach(callbackfn);
    }
}

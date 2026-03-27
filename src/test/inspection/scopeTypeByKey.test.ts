// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import {
    NodeScope,
    ScopeItemKind,
    ScopeTypeByKey,
    TScopeItem,
} from "../../powerquery-language-services/inspection/scope/scope";

const mockXorNode: TXorNode = {} as TXorNode;

function createMockScopeItem(nodeId: number): TScopeItem {
    return {
        kind: ScopeItemKind.Undefined,
        nodeId,
        isRecursive: false,
        xorNode: mockXorNode,
    };
}

function createMockScope(entries: ReadonlyArray<[string, number]>): NodeScope {
    const scopeItemByKey: Map<string, TScopeItem> = new Map<string, TScopeItem>();

    for (const [key, nodeId] of entries) {
        scopeItemByKey.set(key, createMockScopeItem(nodeId));
    }

    return { createdForNodeId: 0, scopeItemByKey };
}

interface CallTracker {
    count: number;
    readonly receivedItems: TScopeItem[];
}

function createCallTracker(): CallTracker {
    return { count: 0, receivedItems: [] };
}

function createMockResolver(
    typeMap: ReadonlyMap<number, Type.TPowerQueryType>,
    callTracker?: CallTracker,
): (scopeItem: TScopeItem) => Promise<Type.TPowerQueryType> {
    // eslint-disable-next-line require-await
    return async (scopeItem: TScopeItem): Promise<Type.TPowerQueryType> => {
        if (callTracker) {
            callTracker.count += 1;
            callTracker.receivedItems.push(scopeItem);
        }

        return typeMap.get(scopeItem.nodeId) ?? Type.UnknownInstance;
    };
}

describe(`ScopeTypeByKey`, () => {
    it(`size reflects full scope before resolution`, () => {
        const nodeScope: NodeScope = createMockScope([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]);

        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(new Map()));
        expect(lazy.resolvedSize).to.equal(0);

        expect(lazy.size).to.equal(3);
        expect(lazy.resolvedSize).to.equal(0);
    });

    it(`has() checks full scope`, () => {
        const nodeScope: NodeScope = createMockScope([["existing", 1]]);
        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(new Map()));
        expect(lazy.resolvedSize).to.equal(0);

        expect(lazy.has("existing")).to.equal(true);
        expect(lazy.has("missing")).to.equal(false);
        expect(lazy.resolvedSize).to.equal(0);
    });

    it(`keys() returns all scope keys before resolution`, () => {
        const nodeScope: NodeScope = createMockScope([
            ["alpha", 1],
            ["beta", 2],
            ["gamma", 3],
        ]);

        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(new Map()));
        expect(lazy.resolvedSize).to.equal(0);

        const keys: string[] = [...lazy.keys()];
        expect(keys).to.have.members(["alpha", "beta", "gamma"]);
        expect(lazy.resolvedSize).to.equal(0);
    });

    it(`resolveType() resolves and caches`, async () => {
        const typeMap: Map<number, Type.TPowerQueryType> = new Map([[1, Type.NumberInstance]]);
        const nodeScope: NodeScope = createMockScope([["key", 1]]);
        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(typeMap));
        expect(lazy.resolvedSize).to.equal(0);

        const result: Type.TPowerQueryType | undefined = await lazy.resolveType("key");
        expect(result).to.equal(Type.NumberInstance);
        expect(lazy.resolvedSize).to.equal(1);

        // Verify caching: resolving the same key should return the same value
        const cachedResult: Type.TPowerQueryType | undefined = await lazy.resolveType("key");
        expect(cachedResult).to.equal(Type.NumberInstance);
        expect(lazy.resolvedSize).to.equal(1);
    });

    it(`resolveType() calls resolver only once per key`, async () => {
        const typeMap: Map<number, Type.TPowerQueryType> = new Map([[1, Type.NumberInstance]]);
        const nodeScope: NodeScope = createMockScope([["key", 1]]);
        const tracker: CallTracker = createCallTracker();
        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(typeMap, tracker));
        expect(lazy.resolvedSize).to.equal(0);

        await lazy.resolveType("key");
        await lazy.resolveType("key");
        expect(tracker.count).to.equal(1);
        expect(lazy.resolvedSize).to.equal(1);
    });

    it(`resolveType() for unknown key returns undefined without calling resolver`, async () => {
        const nodeScope: NodeScope = createMockScope([["key", 1]]);
        const tracker: CallTracker = createCallTracker();
        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(new Map(), tracker));
        expect(lazy.resolvedSize).to.equal(0);

        const result: Type.TPowerQueryType | undefined = await lazy.resolveType("unknown");
        expect(result).to.equal(undefined);
        expect(tracker.count).to.equal(0);
        expect(lazy.resolvedSize).to.equal(0);
    });

    it(`resolveAll() resolves all items`, async () => {
        const typeMap: Map<number, Type.TPowerQueryType> = new Map<number, Type.TPowerQueryType>([
            [1, Type.NumberInstance],
            [2, Type.TextInstance],
            [3, Type.UnknownInstance],
        ]);

        const nodeScope: NodeScope = createMockScope([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]);

        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(typeMap));
        expect(lazy.resolvedSize).to.equal(0);

        const result: ReadonlyMap<string, Type.TPowerQueryType> = await lazy.resolveAll();

        expect(lazy.resolvedSize).to.equal(3);
        expect(result.get("a")).to.equal(Type.NumberInstance);
        expect(result.get("b")).to.equal(Type.TextInstance);
        expect(result.get("c")).to.equal(Type.UnknownInstance);
    });

    it(`resolveAll() skips already-resolved items`, async () => {
        const typeMap: Map<number, Type.TPowerQueryType> = new Map<number, Type.TPowerQueryType>([
            [1, Type.NumberInstance],
            [2, Type.TextInstance],
            [3, Type.UnknownInstance],
        ]);

        const nodeScope: NodeScope = createMockScope([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]);

        const tracker: CallTracker = createCallTracker();
        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(typeMap, tracker));
        expect(lazy.resolvedSize).to.equal(0);

        await lazy.resolveType("a");
        expect(tracker.count).to.equal(1);
        expect(lazy.resolvedSize).to.equal(1);

        await lazy.resolveAll();
        // Total 3 resolver calls: 1 for "a" + 2 for "b" and "c" (not 4)
        expect(tracker.count).to.equal(3);
        expect(lazy.resolvedSize).to.equal(3);
    });

    it(`resolver receives correct scope item for each key`, async () => {
        const typeMap: Map<number, Type.TPowerQueryType> = new Map<number, Type.TPowerQueryType>([
            [10, Type.NumberInstance],
            [20, Type.TextInstance],
        ]);

        const nodeScope: NodeScope = createMockScope([
            ["x", 10],
            ["y", 20],
        ]);

        const tracker: CallTracker = createCallTracker();
        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(typeMap, tracker));
        expect(lazy.resolvedSize).to.equal(0);

        await lazy.resolveType("x");
        expect(tracker.receivedItems[0].nodeId).to.equal(10);
        expect(tracker.receivedItems[0].kind).to.equal(ScopeItemKind.Undefined);
        expect(lazy.resolvedSize).to.equal(1);

        await lazy.resolveType("y");
        expect(tracker.receivedItems[1].nodeId).to.equal(20);
        expect(lazy.resolvedSize).to.equal(2);
    });

    it(`entries() resolves all types then iterates`, async () => {
        const typeMap: Map<number, Type.TPowerQueryType> = new Map<number, Type.TPowerQueryType>([
            [1, Type.NumberInstance],
            [2, Type.TextInstance],
            [3, Type.UnknownInstance],
        ]);

        const nodeScope: NodeScope = createMockScope([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]);

        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(typeMap));
        expect(lazy.resolvedSize).to.equal(0);

        const entries: [string, Type.TPowerQueryType][] = [...(await lazy.entries())];

        expect(lazy.resolvedSize).to.equal(3);
        expect(entries).to.have.lengthOf(3);
        expect(entries).to.deep.include(["a", Type.NumberInstance]);
        expect(entries).to.deep.include(["b", Type.TextInstance]);
        expect(entries).to.deep.include(["c", Type.UnknownInstance]);
    });

    it(`values() resolves all types then iterates`, async () => {
        const typeMap: Map<number, Type.TPowerQueryType> = new Map<number, Type.TPowerQueryType>([
            [1, Type.NumberInstance],
            [2, Type.TextInstance],
        ]);

        const nodeScope: NodeScope = createMockScope([
            ["x", 1],
            ["y", 2],
        ]);

        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(typeMap));
        expect(lazy.resolvedSize).to.equal(0);

        const values: Type.TPowerQueryType[] = [...(await lazy.values())];

        expect(lazy.resolvedSize).to.equal(2);
        expect(values).to.have.lengthOf(2);
        expect(values).to.include(Type.NumberInstance);
        expect(values).to.include(Type.TextInstance);
    });

    it(`forEach() resolves all types then calls callback`, async () => {
        const typeMap: Map<number, Type.TPowerQueryType> = new Map<number, Type.TPowerQueryType>([
            [1, Type.NumberInstance],
            [2, Type.TextInstance],
        ]);

        const nodeScope: NodeScope = createMockScope([
            ["a", 1],
            ["b", 2],
        ]);

        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(typeMap));
        expect(lazy.resolvedSize).to.equal(0);

        const collected: [string, Type.TPowerQueryType][] = [];

        await lazy.forEach((value: Type.TPowerQueryType, key: string) => {
            collected.push([key, value]);
        });

        expect(lazy.resolvedSize).to.equal(2);
        expect(collected).to.have.lengthOf(2);
        expect(collected).to.deep.include(["a", Type.NumberInstance]);
        expect(collected).to.deep.include(["b", Type.TextInstance]);
    });

    it(`entries() on empty scope returns empty iterator`, async () => {
        const nodeScope: NodeScope = createMockScope([]);
        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, createMockResolver(new Map()));
        expect(lazy.resolvedSize).to.equal(0);

        const entries: [string, Type.TPowerQueryType][] = [...(await lazy.entries())];

        expect(lazy.resolvedSize).to.equal(0);
        expect(entries).to.have.lengthOf(0);
    });

    it(`resolveType() propagates resolver errors and does not cache the failure`, async () => {
        const nodeScope: NodeScope = createMockScope([["key", 1]]);
        let shouldThrow: boolean = true;

        const throwingResolver: (
            scopeItem: TScopeItem,
            // eslint-disable-next-line require-await
        ) => Promise<Type.TPowerQueryType> = async (): Promise<Type.TPowerQueryType> => {
            if (shouldThrow) {
                throw new Error("resolver failure");
            }

            return Type.NumberInstance;
        };

        const lazy: ScopeTypeByKey = new ScopeTypeByKey(nodeScope, throwingResolver);
        expect(lazy.resolvedSize).to.equal(0);

        // First call: resolver throws, error propagates
        let caught: boolean = false;

        try {
            await lazy.resolveType("key");
        } catch (error: unknown) {
            caught = true;
            expect((error as Error).message).to.equal("resolver failure");
        }

        expect(caught).to.equal(true);
        expect(lazy.resolvedSize).to.equal(0);

        // Second call: resolver succeeds since the failure was not cached
        shouldThrow = false;
        const result: Type.TPowerQueryType | undefined = await lazy.resolveType("key");
        expect(result).to.equal(Type.NumberInstance);
        expect(lazy.resolvedSize).to.equal(1);
    });
});

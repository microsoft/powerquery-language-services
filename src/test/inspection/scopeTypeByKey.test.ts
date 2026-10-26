// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import * as ScopeUtils from "../../powerquery-language-services/inspection/scope/scopeUtils";
import {
    NodeScope,
    ScopeItemKind,
    ScopeItemTypeResolver,
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

function createMockResolver(
    typeMap: ReadonlyMap<number, Type.TPowerQueryType>,
    receivedItems: TScopeItem[],
): ScopeItemTypeResolver {
    return (scopeItem: TScopeItem): Promise<Type.TPowerQueryType> => {
        receivedItems.push(scopeItem);

        return Promise.resolve(typeMap.get(scopeItem.nodeId) ?? Type.UnknownInstance);
    };
}

describe(`ScopeTypeByKey`, () => {
    it("creates an empty scope through the utility factory", async () => {
        const empty: ScopeTypeByKey = ScopeUtils.emptyScopeTypeByKey();
        expect(await ScopeUtils.resolveType(empty, "missing")).to.equal(undefined);
        expect([...(await ScopeUtils.resolveAll(empty))]).to.deep.equal([]);
    });

    it("keeps resolved types independent for each state record", async () => {
        const nodeScope: NodeScope = createMockScope([["key", 1]]);
        const firstReceivedItems: TScopeItem[] = [];
        const secondReceivedItems: TScopeItem[] = [];

        const first: ScopeTypeByKey = ScopeUtils.createScopeTypeByKey(
            nodeScope,
            createMockResolver(new Map([[1, Type.NumberInstance]]), firstReceivedItems),
        );

        const second: ScopeTypeByKey = ScopeUtils.createScopeTypeByKey(
            nodeScope,
            createMockResolver(new Map([[1, Type.TextInstance]]), secondReceivedItems),
        );

        expect(firstReceivedItems.length).to.equal(0);
        expect(secondReceivedItems.length).to.equal(0);
        expect(await ScopeUtils.resolveType(first, "key")).to.equal(Type.NumberInstance);
        expect(first.resolved.get("key")).to.equal(Type.NumberInstance);
        expect(second.resolved.size).to.equal(0);
        expect(secondReceivedItems.length).to.equal(0);
        expect(await ScopeUtils.resolveType(second, "key")).to.equal(Type.TextInstance);
        expect(await ScopeUtils.resolveType(first, "key")).to.equal(Type.NumberInstance);
        expect(firstReceivedItems.length).to.equal(1);
        expect(secondReceivedItems.length).to.equal(1);
    });

    it("resolves aliases of the same syntax node only once in resolveAll", async () => {
        const nodeScope: NodeScope = createMockScope([
            ["foo", 1],
            ['#"foo"', 1],
            ["other", 2],
        ]);

        const receivedItems: TScopeItem[] = [];

        const lazy: ScopeTypeByKey = ScopeUtils.createScopeTypeByKey(
            nodeScope,
            createMockResolver(
                new Map<number, Type.TPowerQueryType>([
                    [1, Type.NumberInstance],
                    [2, Type.TextInstance],
                ]),
                receivedItems,
            ),
        );

        expect(receivedItems.length).to.equal(0);
        const resolved: ReadonlyMap<string, Type.TPowerQueryType> = await ScopeUtils.resolveAll(lazy);
        expect(resolved).to.equal(lazy.resolved);
        expect(receivedItems.length).to.equal(2);
        expect(resolved.size).to.equal(3);
        expect(resolved.get("foo")).to.equal(Type.NumberInstance);
        expect(resolved.get('#"foo"')).to.equal(resolved.get("foo"));
        expect(resolved.get("other")).to.equal(Type.TextInstance);
        await ScopeUtils.resolveAll(lazy);
        expect(receivedItems.length).to.equal(2);
    });

    it("resolves requested types lazily and caches successful results", async () => {
        const typeMap: Map<number, Type.TPowerQueryType> = new Map([[1, Type.NumberInstance]]);

        const nodeScope: NodeScope = createMockScope([
            ["key", 1],
            ["unused", 2],
        ]);

        const receivedItems: TScopeItem[] = [];

        const lazy: ScopeTypeByKey = ScopeUtils.createScopeTypeByKey(
            nodeScope,
            createMockResolver(typeMap, receivedItems),
        );

        expect(receivedItems.length).to.equal(0);

        expect(await ScopeUtils.resolveType(lazy, "key")).to.equal(Type.NumberInstance);
        expect(await ScopeUtils.resolveType(lazy, "key")).to.equal(Type.NumberInstance);
        expect(receivedItems.length).to.equal(1);
        expect(receivedItems.map((item: TScopeItem) => item.nodeId)).to.deep.equal([1]);
    });

    it("returns undefined for an unknown key without calling the resolver", async () => {
        const nodeScope: NodeScope = createMockScope([["key", 1]]);
        const receivedItems: TScopeItem[] = [];

        const lazy: ScopeTypeByKey = ScopeUtils.createScopeTypeByKey(
            nodeScope,
            createMockResolver(new Map(), receivedItems),
        );

        expect(await ScopeUtils.resolveType(lazy, "unknown")).to.equal(undefined);
        expect(receivedItems.length).to.equal(0);
    });

    it("resolveAll resolves all items and skips already-resolved items", async () => {
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

        const receivedItems: TScopeItem[] = [];

        const lazy: ScopeTypeByKey = ScopeUtils.createScopeTypeByKey(
            nodeScope,
            createMockResolver(typeMap, receivedItems),
        );

        await ScopeUtils.resolveType(lazy, "a");
        expect(receivedItems.length).to.equal(1);

        const resolved: ReadonlyMap<string, Type.TPowerQueryType> = await ScopeUtils.resolveAll(lazy);
        expect(receivedItems.length).to.equal(3);

        expect([...resolved]).to.deep.equal([
            ["a", Type.NumberInstance],
            ["b", Type.TextInstance],
            ["c", Type.UnknownInstance],
        ]);
    });

    it("passes the correct scope item to the resolver", async () => {
        const nodeScope: NodeScope = createMockScope([
            ["x", 10],
            ["y", 20],
        ]);

        const receivedItems: TScopeItem[] = [];

        const lazy: ScopeTypeByKey = ScopeUtils.createScopeTypeByKey(
            nodeScope,
            createMockResolver(new Map(), receivedItems),
        );

        await ScopeUtils.resolveType(lazy, "x");
        await ScopeUtils.resolveType(lazy, "y");

        expect(receivedItems).to.deep.equal([
            ScopeUtils.findScopeItemByLiteral(nodeScope, "x"),
            ScopeUtils.findScopeItemByLiteral(nodeScope, "y"),
        ]);
    });

    it("publishes no partial bulk results on failure and retries unresolved alias groups", async () => {
        const nodeScope: NodeScope = createMockScope([
            ["cached", 0],
            ["a", 1],
            ['#"a"', 1],
            ["b", 2],
        ]);

        const failure: Error = new Error("bulk resolver failure");
        const receivedIds: number[] = [];
        let shouldFail: boolean = true;

        const resolver: ScopeItemTypeResolver = (scopeItem: TScopeItem): Promise<Type.TPowerQueryType> => {
            receivedIds.push(scopeItem.nodeId);

            if (scopeItem.nodeId === 2 && shouldFail) {
                return Promise.reject(failure);
            }

            return Promise.resolve(scopeItem.nodeId === 2 ? Type.TextInstance : Type.NumberInstance);
        };

        const state: ScopeTypeByKey = ScopeUtils.createScopeTypeByKey(nodeScope, resolver);
        await ScopeUtils.resolveType(state, "cached");
        let caught: unknown;

        try {
            await ScopeUtils.resolveAll(state);
        } catch (error: unknown) {
            caught = error;
        }

        expect(caught).to.equal(failure);
        expect([...state.resolved]).to.deep.equal([["cached", Type.NumberInstance]]);
        expect(receivedIds).to.deep.equal([0, 1, 2]);
        shouldFail = false;

        expect([...(await ScopeUtils.resolveAll(state))]).to.deep.equal([
            ["cached", Type.NumberInstance],
            ["a", Type.NumberInstance],
            ['#"a"', Type.NumberInstance],
            ["b", Type.TextInstance],
        ]);

        expect(receivedIds).to.deep.equal([0, 1, 2, 1, 2]);
    });

    it("propagates resolver errors and retries without caching the failure", async () => {
        const nodeScope: NodeScope = createMockScope([["key", 1]]);
        const failure: Error = new Error("resolver failure");
        let calls: number = 0;

        const resolver: ScopeItemTypeResolver = (): Promise<Type.TPowerQueryType> => {
            calls += 1;

            return calls === 1 ? Promise.reject(failure) : Promise.resolve(Type.NumberInstance);
        };

        const lazy: ScopeTypeByKey = ScopeUtils.createScopeTypeByKey(nodeScope, resolver);
        let caught: unknown;

        try {
            await ScopeUtils.resolveType(lazy, "key");
        } catch (error: unknown) {
            caught = error;
        }

        expect(caught).to.equal(failure);
        expect(lazy.resolved.size).to.equal(0);
        expect(await ScopeUtils.resolveType(lazy, "key")).to.equal(Type.NumberInstance);
        expect(await ScopeUtils.resolveType(lazy, "key")).to.equal(Type.NumberInstance);
        expect(calls).to.equal(2);
    });
});

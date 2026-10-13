// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import {
    NodeIdMap,
    NodeIdMapIterator,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { expect } from "chai";
import { IdentifierUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import {
    createBindingScopeMap,
    createScopeBindings,
    mergeScopeMaps,
    scopeForSelf,
    scopeMapEntries,
    scopeMapGet,
    scopeMapHas,
    scopeMapKeys,
} from "../../powerquery-language-services/inspection/scope/scopeBindingsUtils";
import { Inspection } from "../../powerquery-language-services";
import { ScopeBindings } from "../../powerquery-language-services/inspection/scope/scopeBindings";

// Object values let these tests verify that shared maps preserve descriptor identity.
interface Value {
    readonly id: number;
}

describe("Shared scope storage", () => {
    it("does not enumerate inherited bindings when constructing or looking up an overlay", () => {
        const parent: Map<string, Value> = new Map([["parent", { id: 1 }]]);
        const own: Map<string, Value> = new Map([["own", { id: 2 }]]);

        parent.entries = (): MapIterator<[string, Value]> => {
            throw new Error("Unexpected parent enumeration");
        };

        parent[Symbol.iterator] = parent.entries;
        own.entries = parent.entries;
        own[Symbol.iterator] = own.entries;
        const scope: Inspection.ScopeMap<Value> = mergeScopeMaps(parent, own);
        expect(scopeMapGet(scope, "parent")).to.deep.equal({ id: 1 });
        expect(scopeMapGet(scope, "own")).to.deep.equal({ id: 2 });
        expect(scopeMapHas(scope, "missing")).to.equal(false);
        const child: Inspection.ScopeMap<Value> = mergeScopeMaps(scope, new Map([["child", { id: 3 }]]));
        expect(scopeMapGet(child, "parent")).to.deep.equal({ id: 1 });
        expect(scopeMapGet(child, "own")).to.deep.equal({ id: 2 });
        expect(scopeMapGet(child, "child")).to.deep.equal({ id: 3 });
    });

    it("preserves lookup and insertion order when shadowing", () => {
        const first: Value = { id: 1 };
        const second: Value = { id: 2 };
        const third: Value = { id: 3 };

        const parent: Map<string, Value> = new Map([
            ["a", first],
            ["b", second],
        ]);

        const own: Map<string, Value> = new Map([
            ["b", third],
            ["c", first],
        ]);

        const actual: Inspection.ScopeMap<Value> = mergeScopeMaps(parent, own);
        const expected: Map<string, Value> = new Map([...parent, ...own]);

        expect([...scopeMapEntries(actual)]).to.deep.equal([...expected]);
        expect([...scopeMapKeys(actual)]).to.deep.equal([...expected.keys()]);
        expect(scopeMapGet(actual, "b")).to.equal(third);
        expect(scopeMapHas(actual, "missing")).to.equal(false);
        expect(scopeMapGet(actual, "missing")).to.equal(undefined);
        expect(parent.get("b")).to.equal(second);
    });

    it("exposes an outer binding when the current non-recursive binding is masked", () => {
        const outer: Value = { id: 1 };
        const inner: Value = { id: 2 };
        const recursive: Value = { id: 3 };

        const base: Map<string, Value> = new Map([
            ["a", inner],
            ["@a", inner],
            ["b", inner],
        ]);

        const own: Inspection.ScopeMap<Value> = createBindingScopeMap(
            base,
            new Set(["a", "not-in-base"]),
            new Map([["@a", recursive]]),
        );

        const actual: Inspection.ScopeMap<Value> = mergeScopeMaps(new Map([["a", outer]]), own);

        expect([...scopeMapKeys(own)]).to.deep.equal(["@a", "b"]);
        expect(scopeMapGet(own, "a")).to.equal(undefined);
        expect(scopeMapHas(own, "a")).to.equal(false);
        expect(scopeMapGet(actual, "a")).to.equal(outer);
        expect(scopeMapGet(actual, "@a")).to.equal(recursive);
        expect(scopeMapHas(own, "@a")).to.equal(true);
        expect(scopeMapHas(actual, "a")).to.equal(true);
        expect([...scopeMapKeys(actual)]).to.deep.equal(["a", "@a", "b"]);
        expect(base.get("@a")).to.equal(inner);
    });

    it("shares empty overlays and traverses deep parent chains without recursion", () => {
        const baseValue: Value = { id: -1 };
        const base: Map<string, Value> = new Map([["base", baseValue]]);
        expect(mergeScopeMaps(base, new Map())).to.equal(base);
        expect(mergeScopeMaps(new Map(), base)).to.equal(base);
        let scope: Inspection.ScopeMap<Value> = base;

        for (let index: number = 0; index < 10000; index += 1) {
            scope = mergeScopeMaps(scope, new Map([["shared", { id: index }]]));
        }

        expect(scopeMapGet(scope, "base")).to.equal(baseValue);
        expect(scopeMapGet(scope, "shared")).to.deep.equal({ id: 9999 });
        expect(scopeMapHas(scope, "missing")).to.equal(false);

        expect([...scopeMapEntries(scope)]).to.deep.equal([
            ["base", baseValue],
            ["shared", { id: 9999 }],
        ]);
    });

    it("reuses the nonempty side when merging masked binding scopes", () => {
        const parent: Map<string, Value> = new Map([["parent", { id: 1 }]]);

        const empty: Inspection.ScopeMap<Value> = createBindingScopeMap(
            new Map([["a", { id: 2 }]]),
            new Set(["a", "missing"]),
            new Map(),
        );

        const recursive: Value = { id: 3 };

        const nonempty: Inspection.ScopeMap<Value> = createBindingScopeMap(
            new Map([
                ["a", { id: 2 }],
                ["@a", { id: 2 }],
            ]),
            new Set(["a"]),
            new Map([["@a", recursive]]),
        );

        expect([...scopeMapEntries(empty)]).to.deep.equal([]);
        expect(mergeScopeMaps(parent, empty)).to.equal(parent);
        expect(mergeScopeMaps(empty, parent)).to.equal(parent);
        expect(mergeScopeMaps(empty, nonempty)).to.equal(nonempty);
        expect(mergeScopeMaps(nonempty, empty)).to.equal(nonempty);
        expect(scopeMapGet(nonempty, "@a")).to.equal(recursive);
        expect(scopeMapHas(nonempty, "@a")).to.equal(true);
        expect(scopeMapHas(nonempty, "a")).to.equal(false);
    });

    it("keeps sibling overlay bindings independent while sharing their parent", () => {
        const parent: Map<string, Value> = new Map([["parent", { id: 0 }]]);
        const left: Inspection.ScopeMap<Value> = mergeScopeMaps(parent, new Map([["left", { id: 1 }]]));

        const right: Inspection.ScopeMap<Value> = mergeScopeMaps(
            parent,
            new Map([
                ["right", { id: 2 }],
                ["extra", { id: 3 }],
            ]),
        );

        expect(scopeMapGet(left, "parent")).to.equal(parent.get("parent"));
        expect(scopeMapGet(right, "parent")).to.equal(parent.get("parent"));
        expect(scopeMapGet(left, "right")).to.equal(undefined);
        expect(scopeMapGet(right, "left")).to.equal(undefined);
        expect([...scopeMapKeys(left)]).to.deep.equal(["parent", "left"]);
        expect([...scopeMapKeys(right)]).to.deep.equal(["parent", "right", "extra"]);
    });
});

async function parse(text: string): Promise<PQP.Task.ParseTaskOk> {
    const result: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(PQP.DefaultSettings, text);
    PQP.TaskUtils.assertIsParseStageOk(result);

    return result;
}

function scopeItem(
    pair: NodeIdMapIterator.LetKeyValuePair,
    isRecursive: boolean = false,
): Inspection.LetVariableScopeItem {
    return {
        kind: Inspection.ScopeItemKind.LetVariable,
        nodeId: pair.source.node.id,
        isRecursive,
        key: pair.key,
        value: pair.value,
    };
}

describe("Shared sibling bindings", () => {
    for (const text of [
        "let a = 1, b = a, c = b in c",
        'let a = 1, #"a" = 2, b = a in b',
        'let a = 1, b = 2, #"a" = 3, c = a in c',
        'let #"a@b" = 1, c = #"a@b" in c',
        'let #"a b" = 1, #"if" = 2 in #"if"',
    ]) {
        it(`matches materialized scopes for ${text}`, async () => {
            const parsed: PQP.Task.ParseTaskOk = await parse(text);

            const pairs: ReadonlyArray<NodeIdMapIterator.LetKeyValuePair> = NodeIdMapIterator.iterLetExpression(
                parsed.nodeIdMapCollection,
                XorNodeUtils.boxAst(parsed.ast),
            );

            const options: IdentifierUtils.GetAllowedIdentifiersOptions = { allowRecursive: true };

            const bindings: ScopeBindings<Inspection.LetVariableScopeItem> = createScopeBindings(
                pairs,
                options,
                scopeItem,
                undefined,
            );

            const all: Inspection.ScopeMap<Inspection.LetVariableScopeItem> = bindings.all;
            const allEntries: [string, Inspection.LetVariableScopeItem][] = [...scopeMapEntries(all)];

            for (const ownId of [undefined, ...pairs.map((pair: NodeIdMapIterator.LetKeyValuePair) => pair.key.id)]) {
                const expected: Map<string, Inspection.LetVariableScopeItem> = new Map();

                for (const pair of pairs) {
                    const recursive: boolean = pair.key.id === ownId;

                    for (const key of IdentifierUtils.getAllowedIdentifiers(pair.key.literal, options)) {
                        if (!recursive || key.includes("@")) {
                            expected.set(key, scopeItem(pair, recursive));
                        }
                    }
                }

                const actual: Inspection.ScopeMap<Inspection.LetVariableScopeItem> =
                    ownId === undefined ? bindings.all : scopeForSelf(bindings, ownId);

                expect([...scopeMapEntries(actual)]).to.deep.equal([...expected]);
            }

            expect(bindings.all).to.equal(all);
            expect([...scopeMapEntries(bindings.all)]).to.deep.equal(allEntries);
        });
    }

    it("interns ordinary and recursive descriptors instead of recreating them for every sibling", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("let a = 1, b = 2, c = 3 in c");

        const pairs: ReadonlyArray<NodeIdMapIterator.LetKeyValuePair> = NodeIdMapIterator.iterLetExpression(
            parsed.nodeIdMapCollection,
            XorNodeUtils.boxAst(parsed.ast),
        );

        let calls: number = 0;

        const bindings: ScopeBindings<Inspection.LetVariableScopeItem> = createScopeBindings(
            pairs,
            { allowRecursive: true },
            (pair: NodeIdMapIterator.LetKeyValuePair) => {
                calls += 1;

                return scopeItem(pair);
            },
            undefined,
        );

        expect(bindings.bindingByKeyId.get(pairs[0].key.id)?.recursive).to.equal(undefined);
        const ordinary: Inspection.LetVariableScopeItem = PQP.Assert.asDefined(bindings.all.get("a"));
        const a: Inspection.ScopeMap<Inspection.LetVariableScopeItem> = scopeForSelf(bindings, pairs[0].key.id);
        const b: Inspection.ScopeMap<Inspection.LetVariableScopeItem> = scopeForSelf(bindings, pairs[1].key.id);
        expect(scopeMapGet(a, "c")).to.equal(scopeMapGet(b, "c"));
        expect(scopeMapGet(a, "@a")).to.equal(scopeMapGet(scopeForSelf(bindings, pairs[0].key.id), "@a"));
        expect(scopeMapGet(a, "@a")).to.deep.equal({ ...ordinary, isRecursive: true });
        expect(scopeMapGet(a, "@a")).not.to.equal(ordinary);
        expect(scopeMapGet(b, "a")).to.equal(ordinary);
        expect(ordinary.isRecursive).to.equal(false);
        expect(bindings.bindingByKeyId.get(pairs[0].key.id)?.recursive).to.equal(scopeMapGet(a, "@a"));
        expect(bindings.bindingByKeyId.get(pairs[2].key.id)?.recursive).to.equal(undefined);
        expect(calls).to.equal(3);
    });
});

describe("Completed scope inspection cache", () => {
    it("keeps completion metadata with its document-owned cache", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("let a = 1 in a");
        const first: Inspection.TypeCache = Inspection.TypeCacheUtils.emptyCache();
        const second: Inspection.TypeCache = Inspection.TypeCacheUtils.emptyCache();
        const target: number = PQP.Assert.asDefined(parsed.nodeIdMapCollection.rightMostLeaf).id;

        PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(
                PQP.DefaultSettings,
                parsed.nodeIdMapCollection,
                undefined,
                target,
                first.scopeById,
            ),
        );

        expect(first.scopeById.inspectedNodes.has(parsed.ast)).to.equal(true);
        expect(second.scopeById.inspectedNodes.has(parsed.ast)).to.equal(false);
        expect(second.scopeById.scopes.size).to.equal(0);

        PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(
                PQP.DefaultSettings,
                parsed.nodeIdMapCollection,
                undefined,
                target,
                second.scopeById,
            ),
        );

        Inspection.ScopeUtils.clearScopeById(first.scopeById);
        expect(first.scopeById.scopes.size).to.equal(0);
        expect(first.scopeById.inspectedNodes.has(parsed.ast)).to.equal(false);
        expect(second.scopeById.inspectedNodes.has(parsed.ast)).to.equal(true);
    });

    it("reuses completed ancestor inspection across requests for different nodes", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("let a = 1, b = (x) => x in b");

        const scopes: Inspection.ScopeById = Inspection.ScopeUtils.createScopeById();
        let rootInspections: number = 0;

        const markInspectionComplete: (node: TXorNode["node"]) => WeakSet<TXorNode["node"]> =
            scopes.inspectedNodes.add.bind(scopes.inspectedNodes);

        scopes.inspectedNodes.add = (node: TXorNode["node"]): WeakSet<TXorNode["node"]> => {
            if (node === parsed.ast) {
                rootInspections += 1;
            }

            return markInspectionComplete(node);
        };

        const pairs: ReadonlyArray<NodeIdMapIterator.LetKeyValuePair> = NodeIdMapIterator.iterLetExpression(
            parsed.nodeIdMapCollection,
            XorNodeUtils.boxAst(parsed.ast),
        );

        PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(
                PQP.DefaultSettings,
                parsed.nodeIdMapCollection,
                undefined,
                PQP.Assert.asDefined(pairs[0].value).node.id,
                scopes,
            ),
        );

        const target: number = PQP.Assert.asDefined(parsed.nodeIdMapCollection.rightMostLeaf).id;
        expect(scopes.scopes.has(target)).to.equal(false);
        expect(rootInspections).to.equal(1);

        PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(PQP.DefaultSettings, parsed.nodeIdMapCollection, undefined, target, scopes),
        );

        expect(scopes.scopes.has(target)).to.equal(true);
        expect(rootInspections).to.equal(1);
    });

    it("preserves completion on publication but invalidates replacement, deletion and clearing", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("1");
        const scopes: Inspection.ScopeById = Inspection.ScopeUtils.createScopeById();

        const scope: Inspection.NodeScope = {
            createdForNodeId: parsed.ast.id,
            scopeItemByKey: new Map(),
        };

        Inspection.ScopeUtils.setScopeById(scopes, parsed.ast.id, scope);
        scopes.inspectedNodes.add(parsed.ast);
        Inspection.ScopeUtils.setScopeById(scopes, -1, scope);
        Inspection.ScopeUtils.setScopeById(scopes, parsed.ast.id, scope);
        expect(scopes.inspectedNodes.has(parsed.ast)).to.equal(true);
        expect(Inspection.ScopeUtils.deleteScopeById(scopes, -2)).to.equal(false);
        expect(scopes.inspectedNodes.has(parsed.ast)).to.equal(true);

        Inspection.ScopeUtils.setScopeById(scopes, parsed.ast.id, { ...scope });
        expect(scopes.inspectedNodes.has(parsed.ast)).to.equal(false);
        scopes.inspectedNodes.add(parsed.ast);
        expect(Inspection.ScopeUtils.deleteScopeById(scopes, -1)).to.equal(true);
        Inspection.ScopeUtils.setScopeById(scopes, -1, scope);
        expect(scopes.scopes.size).to.equal(2);
        expect(scopes.inspectedNodes.has(parsed.ast)).to.equal(false);

        scopes.inspectedNodes.add(parsed.ast);
        Inspection.ScopeUtils.clearScopeById(scopes);
        expect(scopes.scopes.size).to.equal(0);
        expect(scopes.inspectedNodes.has(parsed.ast)).to.equal(false);
    });

    it("does not mark partially cancelled inspection complete", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("section S; shared a = 1; shared b = a; shared c = b;");

        const pairs: ReadonlyArray<NodeIdMapIterator.SectionKeyValuePair> = NodeIdMapIterator.iterSection(
            parsed.nodeIdMapCollection,
            XorNodeUtils.boxAst(parsed.ast),
        );

        const scopes: Inspection.ScopeById = Inspection.ScopeUtils.createScopeById();
        const target: number = PQP.Assert.asDefined(pairs[2].value).node.id;

        const cancellationToken: PQP.ICancellationToken = {
            ...PQP.NoOpCancellationToken,
            throwIfCancelled: () => {
                if (scopes.scopes.size !== 0) {
                    throw new PQP.CommonError.CancellationError(cancellationToken, "First scope was published");
                }
            },
        };

        const cancelled: Inspection.TriedNodeScope = await Inspection.tryNodeScope(
            { ...PQP.DefaultSettings, cancellationToken },
            parsed.nodeIdMapCollection,
            undefined,
            target,
            scopes,
        );

        expect(PQP.ResultUtils.isError(cancelled)).to.equal(true);
        expect(scopes.scopes.size).to.equal(1);
        expect(scopes.inspectedNodes.has(parsed.ast)).to.equal(false);

        const retried: Inspection.NodeScope = PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(PQP.DefaultSettings, parsed.nodeIdMapCollection, undefined, target, scopes),
        );

        const fresh: Inspection.NodeScope = PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(
                PQP.DefaultSettings,
                parsed.nodeIdMapCollection,
                undefined,
                target,
                Inspection.ScopeUtils.createScopeById(),
            ),
        );

        expect([...scopeMapEntries(retried.scopeItemByKey)]).to.deep.equal([...scopeMapEntries(fresh.scopeItemByKey)]);
        expect(scopeMapHas(retried.scopeItemByKey, "b")).to.equal(true);
        expect(scopes.inspectedNodes.has(parsed.ast)).to.equal(true);
    });

    it("checks cancellation before reusing completed ancestor inspection", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("let a = 1, b = (x) => x in b");
        const scopes: Inspection.ScopeById = Inspection.ScopeUtils.createScopeById();

        const pairs: ReadonlyArray<NodeIdMapIterator.LetKeyValuePair> = NodeIdMapIterator.iterLetExpression(
            parsed.nodeIdMapCollection,
            XorNodeUtils.boxAst(parsed.ast),
        );

        PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(
                PQP.DefaultSettings,
                parsed.nodeIdMapCollection,
                undefined,
                PQP.Assert.asDefined(pairs[0].value).node.id,
                scopes,
            ),
        );

        const target: number = PQP.Assert.asDefined(parsed.nodeIdMapCollection.rightMostLeaf).id;
        expect(scopes.scopes.has(target)).to.equal(false);

        const cancelled: Inspection.TriedNodeScope = await Inspection.tryNodeScope(
            { ...PQP.DefaultSettings, cancellationToken: PQP.ExpiredCancellationToken },
            parsed.nodeIdMapCollection,
            undefined,
            target,
            scopes,
        );

        expect(PQP.ResultUtils.isError(cancelled)).to.equal(true);
    });

    it("rebuilds scopes after cache clearing, removal and reuse with another document", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("section S; shared a = 1; shared b = a;");
        const maps: NodeIdMap.Collection = parsed.nodeIdMapCollection;
        const scopes: Inspection.ScopeById = Inspection.ScopeUtils.createScopeById();
        const leafId: number = PQP.Assert.asDefined(maps.rightMostLeaf).id;

        const inspect: () => Promise<Inspection.NodeScope> = async () =>
            PQP.ResultUtils.assertOk(
                await Inspection.tryNodeScope(PQP.DefaultSettings, maps, undefined, leafId, scopes),
            );

        const initial: Inspection.NodeScope = await inspect();
        const originalSize: number = scopes.scopes.size;
        Inspection.ScopeUtils.deleteScopeById(scopes, leafId);
        Inspection.ScopeUtils.setScopeById(scopes, -1, initial);
        expect(scopes.scopes.size).to.equal(originalSize);

        expect([...scopeMapEntries((await inspect()).scopeItemByKey)]).to.deep.equal([
            ...scopeMapEntries(initial.scopeItemByKey),
        ]);

        Inspection.ScopeUtils.clearScopeById(scopes);

        expect([...scopeMapEntries((await inspect()).scopeItemByKey)]).to.deep.equal([
            ...scopeMapEntries(initial.scopeItemByKey),
        ]);

        const other: PQP.Task.ParseTaskOk = await parse("let different = 1 in different");
        Inspection.ScopeUtils.clearScopeById(scopes);

        const otherScope: Inspection.NodeScope = PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(
                PQP.DefaultSettings,
                other.nodeIdMapCollection,
                undefined,
                PQP.Assert.asDefined(other.nodeIdMapCollection.rightMostLeaf).id,
                scopes,
            ),
        );

        expect(scopeMapHas(otherScope.scopeItemByKey, "different")).to.equal(true);
        expect(scopeMapHas(otherScope.scopeItemByKey, "a")).to.equal(false);
    });
});

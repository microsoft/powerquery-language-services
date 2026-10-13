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
    BindingScopeMap,
    mergeScopeMaps,
    ScopeBindings,
} from "../../powerquery-language-services/inspection/scope/scopeBindings";
import { Inspection } from "../../powerquery-language-services";

// Object values let these tests verify that shared maps preserve descriptor identity.
interface Value {
    readonly id: number;
}

describe("Shared scope storage", () => {
    it("does not enumerate inherited bindings when constructing or looking up an overlay", () => {
        class LookupOnlyMap extends Map<string, Value> {
            public override entries(): MapIterator<[string, Value]> {
                throw new Error("Unexpected parent enumeration");
            }

            public override [Symbol.iterator](): MapIterator<[string, Value]> {
                return this.entries();
            }
        }

        const parent: LookupOnlyMap = new LookupOnlyMap([["parent", { id: 1 }]]);
        const scope: ReadonlyMap<string, Value> = mergeScopeMaps(parent, new Map([["own", { id: 2 }]]));
        expect(scope.get("parent")).to.deep.equal({ id: 1 });
        expect(scope.get("own")).to.deep.equal({ id: 2 });
        expect(scope.has("missing")).to.equal(false);
        expect(scope.size).to.equal(2);
    });

    it("preserves lookup, insertion order, size and callback semantics when shadowing", () => {
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

        const actual: ReadonlyMap<string, Value> = mergeScopeMaps(parent, own);
        const expected: Map<string, Value> = new Map([...parent, ...own]);

        expect([...actual]).to.deep.equal([...expected]);
        expect([...actual.keys()]).to.deep.equal([...expected.keys()]);
        expect([...actual.values()]).to.deep.equal([...expected.values()]);
        expect(actual.size).to.equal(expected.size);
        expect(actual.get("b")).to.equal(third);
        expect(actual.has("missing")).to.equal(false);
        expect(actual.get("missing")).to.equal(undefined);
        expect(parent.get("b")).to.equal(second);
        expect(Object.prototype.toString.call(actual)).to.equal("[object Map]");

        const context: { seen: [string, Value][] } = { seen: [] };

        actual.forEach(function (
            this: typeof context,
            value: Value,
            key: string,
            map: ReadonlyMap<string, Value>,
        ): void {
            expect(map).to.equal(actual);
            this.seen.push([key, value]);
        }, context);

        expect(context.seen).to.deep.equal([...expected]);
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

        const own: BindingScopeMap<Value> = new BindingScopeMap(
            base,
            new Set(["a", "not-in-base"]),
            new Map([["@a", recursive]]),
        );

        const actual: ReadonlyMap<string, Value> = mergeScopeMaps(new Map([["a", outer]]), own);

        expect(own.size).to.equal(2);
        expect(own.get("a")).to.equal(undefined);
        expect(own.has("a")).to.equal(false);
        expect(actual.get("a")).to.equal(outer);
        expect(actual.get("@a")).to.equal(recursive);
        expect([...actual.keys()]).to.deep.equal(["a", "@a", "b"]);
        expect(base.get("@a")).to.equal(inner);
    });

    it("shares empty overlays and traverses deep parent chains without recursion", () => {
        const baseValue: Value = { id: -1 };
        const base: Map<string, Value> = new Map([["base", baseValue]]);
        expect(mergeScopeMaps(base, new Map())).to.equal(base);
        expect(mergeScopeMaps(new Map(), base)).to.equal(base);
        let scope: ReadonlyMap<string, Value> = base;

        for (let index: number = 0; index < 10000; index += 1) {
            scope = mergeScopeMaps(scope, new Map([["shared", { id: index }]]));
        }

        expect(scope.size).to.equal(2);
        expect(scope.get("base")).to.equal(baseValue);
        expect(scope.get("shared")).to.deep.equal({ id: 9999 });
        expect(scope.has("missing")).to.equal(false);

        expect([...scope]).to.deep.equal([
            ["base", baseValue],
            ["shared", { id: 9999 }],
        ]);
    });
});

async function parse(text: string): Promise<PQP.Task.ParseTaskOk> {
    const result: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(PQP.DefaultSettings, text);
    PQP.TaskUtils.assertIsParseStageOk(result);

    return result;
}

function scopeItem(pair: NodeIdMapIterator.LetKeyValuePair, isRecursive: boolean): Inspection.LetVariableScopeItem {
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

            const bindings: ScopeBindings<NodeIdMapIterator.LetKeyValuePair, Inspection.LetVariableScopeItem> =
                new ScopeBindings(pairs, options, scopeItem, undefined);

            for (const ownId of [-1, ...pairs.map((pair: NodeIdMapIterator.LetKeyValuePair) => pair.key.id)]) {
                const expected: Map<string, Inspection.LetVariableScopeItem> = new Map();

                for (const pair of pairs) {
                    const recursive: boolean = pair.key.id === ownId;

                    for (const key of IdentifierUtils.getAllowedIdentifiers(pair.key.literal, options)) {
                        if (!recursive || key.includes("@")) {
                            expected.set(key, scopeItem(pair, recursive));
                        }
                    }
                }

                const actual: ReadonlyMap<string, Inspection.LetVariableScopeItem> = bindings.forSelf(ownId);
                expect([...actual]).to.deep.equal([...expected]);
                expect(actual.size).to.equal(expected.size);
            }
        });
    }

    it("interns ordinary and recursive descriptors instead of recreating them for every sibling", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("let a = 1, b = 2, c = 3 in c");

        const pairs: ReadonlyArray<NodeIdMapIterator.LetKeyValuePair> = NodeIdMapIterator.iterLetExpression(
            parsed.nodeIdMapCollection,
            XorNodeUtils.boxAst(parsed.ast),
        );

        let calls: number = 0;

        const bindings: ScopeBindings<NodeIdMapIterator.LetKeyValuePair, Inspection.LetVariableScopeItem> =
            new ScopeBindings(
                pairs,
                { allowRecursive: true },
                (pair: NodeIdMapIterator.LetKeyValuePair, recursive: boolean) => {
                    calls += 1;

                    return scopeItem(pair, recursive);
                },
                undefined,
            );

        const a: ReadonlyMap<string, Inspection.LetVariableScopeItem> = bindings.forSelf(pairs[0].key.id);
        const b: ReadonlyMap<string, Inspection.LetVariableScopeItem> = bindings.forSelf(pairs[1].key.id);
        expect(a.get("c")).to.equal(b.get("c"));
        expect(a.get("@a")).to.equal(bindings.forSelf(pairs[0].key.id).get("@a"));
        expect(calls).to.equal(5);
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

        expect(first.scopeById.isInspectionComplete(parsed.ast)).to.equal(true);
        expect(second.scopeById.isInspectionComplete(parsed.ast)).to.equal(false);
        expect(second.scopeById.size).to.equal(0);

        PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(
                PQP.DefaultSettings,
                parsed.nodeIdMapCollection,
                undefined,
                target,
                second.scopeById,
            ),
        );

        first.scopeById.clear();
        expect(first.scopeById.size).to.equal(0);
        expect(first.scopeById.isInspectionComplete(parsed.ast)).to.equal(false);
        expect(second.scopeById.isInspectionComplete(parsed.ast)).to.equal(true);
    });

    it("reuses completed ancestor inspection across requests for different nodes", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("let a = 1, b = (x) => x in b");

        class CountingScopeById extends Inspection.ScopeById {
            public rootInspections: number = 0;

            public override markInspectionComplete(node: TXorNode["node"]): void {
                if (node === parsed.ast) {
                    this.rootInspections += 1;
                }

                super.markInspectionComplete(node);
            }
        }

        const scopes: CountingScopeById = new CountingScopeById();

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
        expect(scopes.has(target)).to.equal(false);
        expect(scopes.rootInspections).to.equal(1);

        PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(PQP.DefaultSettings, parsed.nodeIdMapCollection, undefined, target, scopes),
        );

        expect(scopes.has(target)).to.equal(true);
        expect(scopes.rootInspections).to.equal(1);
    });

    it("preserves completion on publication but invalidates replacement, deletion and clearing", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("1");
        const scopes: Inspection.ScopeById = new Inspection.ScopeById();

        const scope: Inspection.NodeScope = {
            createdForNodeId: parsed.ast.id,
            scopeItemByKey: new Map(),
        };

        scopes.set(parsed.ast.id, scope);
        scopes.markInspectionComplete(parsed.ast);
        scopes.set(-1, scope);
        scopes.set(parsed.ast.id, scope);
        expect(scopes.isInspectionComplete(parsed.ast)).to.equal(true);
        expect(scopes.delete(-2)).to.equal(false);
        expect(scopes.isInspectionComplete(parsed.ast)).to.equal(true);

        scopes.set(parsed.ast.id, { ...scope });
        expect(scopes.isInspectionComplete(parsed.ast)).to.equal(false);
        scopes.markInspectionComplete(parsed.ast);
        expect(scopes.delete(-1)).to.equal(true);
        scopes.set(-1, scope);
        expect(scopes.size).to.equal(2);
        expect(scopes.isInspectionComplete(parsed.ast)).to.equal(false);

        scopes.markInspectionComplete(parsed.ast);
        scopes.clear();
        expect(scopes.size).to.equal(0);
        expect(scopes.isInspectionComplete(parsed.ast)).to.equal(false);
    });

    it("does not mark partially cancelled inspection complete", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("section S; shared a = 1; shared b = a; shared c = b;");

        const pairs: ReadonlyArray<NodeIdMapIterator.SectionKeyValuePair> = NodeIdMapIterator.iterSection(
            parsed.nodeIdMapCollection,
            XorNodeUtils.boxAst(parsed.ast),
        );

        const scopes: Inspection.ScopeById = new Inspection.ScopeById();
        const target: number = PQP.Assert.asDefined(pairs[2].value).node.id;

        const cancellationToken: PQP.ICancellationToken = {
            ...PQP.NoOpCancellationToken,
            throwIfCancelled: () => {
                if (scopes.size !== 0) {
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
        expect(scopes.size).to.equal(1);
        expect(scopes.isInspectionComplete(parsed.ast)).to.equal(false);

        const retried: Inspection.NodeScope = PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(PQP.DefaultSettings, parsed.nodeIdMapCollection, undefined, target, scopes),
        );

        const fresh: Inspection.NodeScope = PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(
                PQP.DefaultSettings,
                parsed.nodeIdMapCollection,
                undefined,
                target,
                new Inspection.ScopeById(),
            ),
        );

        expect([...retried.scopeItemByKey]).to.deep.equal([...fresh.scopeItemByKey]);
        expect(retried.scopeItemByKey.has("b")).to.equal(true);
        expect(scopes.isInspectionComplete(parsed.ast)).to.equal(true);
    });

    it("checks cancellation before reusing completed ancestor inspection", async () => {
        const parsed: PQP.Task.ParseTaskOk = await parse("let a = 1, b = (x) => x in b");
        const scopes: Inspection.ScopeById = new Inspection.ScopeById();

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
        expect(scopes.has(target)).to.equal(false);

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
        const scopes: Inspection.ScopeById = new Inspection.ScopeById();
        const leafId: number = PQP.Assert.asDefined(maps.rightMostLeaf).id;

        const inspect: () => Promise<Inspection.NodeScope> = async () =>
            PQP.ResultUtils.assertOk(
                await Inspection.tryNodeScope(PQP.DefaultSettings, maps, undefined, leafId, scopes),
            );

        const initial: Inspection.NodeScope = await inspect();
        const originalSize: number = scopes.size;
        scopes.delete(leafId);
        scopes.set(-1, initial);
        expect(scopes.size).to.equal(originalSize);
        expect([...(await inspect()).scopeItemByKey]).to.deep.equal([...initial.scopeItemByKey]);
        scopes.clear();
        expect([...(await inspect()).scopeItemByKey]).to.deep.equal([...initial.scopeItemByKey]);

        const other: PQP.Task.ParseTaskOk = await parse("let different = 1 in different");
        scopes.clear();

        const otherScope: Inspection.NodeScope = PQP.ResultUtils.assertOk(
            await Inspection.tryNodeScope(
                PQP.DefaultSettings,
                other.nodeIdMapCollection,
                undefined,
                PQP.Assert.asDefined(other.nodeIdMapCollection.rightMostLeaf).id,
                scopes,
            ),
        );

        expect(otherScope.scopeItemByKey.has("different")).to.equal(true);
        expect(otherScope.scopeItemByKey.has("a")).to.equal(false);
    });
});

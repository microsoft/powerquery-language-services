// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Benchmark-only prototypes. Production source and dependency installations are not modified.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { registerHooks } = require("node:module");
const { fileURLToPath } = require("node:url");
const allowedByIdentifier = new WeakMap();
const itemsByNode = new WeakMap();
const processedByScopeCache = new WeakMap();
const plansByPairs = new WeakMap();
const stats = { aliasMisses: 0, aliasHits: 0, itemMisses: 0, itemHits: 0, inspectedHits: 0 };

function allowed(identifier, options, factory) {
    let byOptions = allowedByIdentifier.get(identifier);
    if (!byOptions) {
        byOptions = new Map();
        allowedByIdentifier.set(identifier, byOptions);
    }
    const key = JSON.stringify(options);
    if (byOptions.has(key)) {
        stats.aliasHits++;
        return byOptions.get(key);
    }
    stats.aliasMisses++;
    const result = factory(identifier.literal, options);
    byOptions.set(key, result);
    return result;
}

function item(pair, recursive, factory) {
    let cached = itemsByNode.get(pair.source.node);
    if (!cached) {
        cached = new Map();
        itemsByNode.set(pair.source.node, cached);
    }
    const key = recursive ? 1 : 0;
    if (!cached.has(key)) {
        stats.itemMisses++;
        cached.set(key, factory(pair, recursive));
    } else {
        stats.itemHits++;
    }
    return cached.get(key);
}

function alreadyInspected(state, node) {
    if (processedByScopeCache.get(state.scopeById)?.has(node.node.id)) {
        state.cancellationToken?.throwIfCancelled();
        stats.inspectedHits++;
        return true;
    }
    return false;
}

function markInspected(state, node) {
    let ids = processedByScopeCache.get(state.scopeById);
    if (!ids) {
        ids = new Set();
        processedByScopeCache.set(state.scopeById, ids);
    }
    ids.add(node.node.id);
}

class BindingMap {
    constructor(base, hidden, recursive) {
        this.base = base;
        this.hidden = hidden;
        this.recursive = recursive;
    }
    get size() {
        return this.base.size - this.hidden.size;
    }
    get(key) {
        return this.hidden.has(key) ? undefined : (this.recursive.get(key) ?? this.base.get(key));
    }
    has(key) {
        return !this.hidden.has(key) && this.base.has(key);
    }
    *entries() {
        for (const [key, value] of this.base) if (!this.hidden.has(key)) yield [key, this.recursive.get(key) ?? value];
    }
    *keys() {
        for (const [key] of this.entries()) yield key;
    }
    *values() {
        for (const [, value] of this.entries()) yield value;
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    forEach(callback, thisArg) {
        for (const [key, value] of this) callback.call(thisArg, value, key, this);
    }
}

class MergedMap {
    constructor(parent, own) {
        this.parent = parent;
        this.own = own;
    }
    get size() {
        if (this.cachedSize === undefined) {
            let size = this.parent.size;
            for (const key of this.own.keys()) if (!this.parent.has(key)) size++;
            this.cachedSize = size;
        }
        return this.cachedSize;
    }
    get(key) {
        return this.own.get(key) ?? this.parent.get(key);
    }
    has(key) {
        return this.own.has(key) || this.parent.has(key);
    }
    *entries() {
        for (const [key, value] of this.parent) yield [key, this.own.get(key) ?? value];
        for (const entry of this.own) if (!this.parent.has(entry[0])) yield entry;
    }
    *keys() {
        for (const [key] of this.entries()) yield key;
    }
    *values() {
        for (const [, value] of this.entries()) yield value;
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    forEach(callback, thisArg) {
        for (const [key, value] of this) callback.call(thisArg, value, key, this);
    }
}

function rootMap(entries) {
    return entries instanceof BindingMap ? entries : new Map(entries ?? []);
}

function merge(parent, entries) {
    const own = rootMap(entries);
    if (!own.size) return parent;
    if (!parent.size) return own;
    return new MergedMap(parent, own);
}

function entriesFor(pairs, ownId, options, factory, aliases) {
    let plans = plansByPairs.get(pairs);
    if (!plans) {
        plans = new Map();
        plansByPairs.set(pairs, plans);
    }
    const optionsKey = JSON.stringify(options);
    let plan = plans.get(optionsKey);
    if (!plan) {
        const base = new Map();
        const pairsByKeyId = new Map();
        let duplicate = false;
        for (const pair of pairs) {
            if (pair.value === undefined) continue;
            const keys = allowed(pair.key, options, aliases);
            pairsByKeyId.set(pair.key.id, { pair, keys });
            const value = item(pair, false, factory);
            for (const key of keys) {
                if (base.has(key) && base.get(key).nodeId !== value.nodeId) duplicate = true;
                base.set(key, value);
            }
        }
        plan = { base, pairsByKeyId, duplicate };
        plans.set(optionsKey, plan);
    }
    // Duplicate aliases can change native Map insertion order when the current binding is excluded.
    if (plan.duplicate) {
        const result = [];
        for (const pair of pairs) {
            if (pair.value === undefined) continue;
            const recursive = pair.key.id === ownId;
            for (const key of allowed(pair.key, options, aliases)) {
                if (!recursive || key.includes("@")) result.push([key, item(pair, recursive, factory)]);
            }
        }
        return result;
    }
    const own = plan.pairsByKeyId.get(ownId);
    const hidden = new Set();
    const recursive = new Map();
    if (own) {
        for (const key of own.keys) {
            if (key.includes("@")) recursive.set(key, item(own.pair, true, factory));
            else hidden.add(key);
        }
    }
    return new BindingMap(plan.base, hidden, recursive);
}

function replaceOnce(source, before, after) {
    assert.equal(source.split(before).length, 2, `Prototype transform no longer matches: ${before}`);
    return source.replace(before, after);
}

function install(mode) {
    assert(["intern", "memo", "overlay"].includes(mode), "SCOPE_EXPERIMENT must be intern, memo or overlay");
    registerHooks({
        load(url, context, nextLoad) {
            if (!url.startsWith("file:")) return nextLoad(url, context);
            const file = fileURLToPath(url);
            if (!file.endsWith(path.join("inspection", "scope", "scopeInspection.js"))) {
                return nextLoad(url, context);
            }
            let source = fs.readFileSync(file, "utf8");
            source = `const scopeExperiment = require(${JSON.stringify(__filename)});\n${source}`;
            source = replaceOnce(
                source,
                "language_1.IdentifierUtils.getAllowedIdentifiers(kvp.key.literal, getAllowedIdentifiersOptions)",
                "scopeExperiment.allowed(kvp.key, getAllowedIdentifiersOptions, language_1.IdentifierUtils.getAllowedIdentifiers)",
            );
            source = replaceOnce(
                source,
                "result.push([key, scopeItemFactory(kvp, isRecursive)]);",
                "result.push([key, scopeExperiment.item(kvp, isRecursive, scopeItemFactory)]);",
            );
            if (mode === "memo" || mode === "overlay") {
                source = replaceOnce(
                    source,
                    "async function inspectNode(state, xorNode, correlationId) {",
                    "async function inspectNode(state, xorNode, correlationId) {\n    if (scopeExperiment.alreadyInspected(state, xorNode)) return;",
                );
                source = replaceOnce(
                    source,
                    "    trace.exit();\n}\nfunction inspectEachExpression",
                    "    scopeExperiment.markInspected(state, xorNode);\n    trace.exit();\n}\nfunction inspectEachExpression",
                );
            }
            if (mode === "overlay") {
                const start = source.indexOf("function scopeItemFactoryForKeyValuePairs(");
                const end = source.indexOf("\nfunction scopeItemFactoryForLetVariable", start);
                assert(start >= 0 && end > start);
                source =
                    source.slice(0, start) +
                    "function scopeItemFactoryForKeyValuePairs(pairs, ownId, options, factory) {\n" +
                    "    return scopeExperiment.entriesFor(pairs, ownId, options, factory, language_1.IdentifierUtils.getAllowedIdentifiers);\n}\n" +
                    source.slice(end);
                source = replaceOnce(source, "new Map(newEntries ?? [])", "scopeExperiment.rootMap(newEntries)");
                source = replaceOnce(
                    source,
                    "new Map([...inheritedScope.scopeItemByKey.entries(), ...newEntries])",
                    "scopeExperiment.merge(inheritedScope.scopeItemByKey, newEntries)",
                );
            }
            return { format: "commonjs", source, shortCircuit: true };
        },
    });
}

module.exports = { install, allowed, item, alreadyInspected, markInspected, entriesFor, rootMap, merge, stats };

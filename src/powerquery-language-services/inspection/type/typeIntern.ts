// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Type interning module: assigns each structurally unique type a canonical string key.
// This enables O(1) deduplication via native Map/Set instead of O(n²) ImmutableSet.

import * as PQP from "@microsoft/powerquery-parser";

import type { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

// Cache computed keys to avoid recomputation on the same object reference
const keyCache: WeakMap<object, string> = new WeakMap();

/**
 * Computes a deterministic canonical string key for any TPowerQueryType.
 * Two types produce the same key if and only if isEqualType(a, b) === true.
 *
 * Performance: O(depth × fields) per type on first call, O(1) thereafter (cached per reference).
 */
export function typeToKey(type: Type.TPowerQueryType): string {
    const cached = keyCache.get(type);

    if (cached !== undefined) {
        return cached;
    }

    const key = computeTypeKey(type);
    keyCache.set(type, key);

    return key;
}

function computeTypeKey(type: Type.TPowerQueryType): string {
    // Primitives: kind + nullable is sufficient (they're singletons anyway)
    if (type.extendedKind === undefined) {
        return `${type.kind}|${type.isNullable ? 1 : 0}`;
    }

    switch (type.extendedKind) {
        case PQP.Language.Type.ExtendedTypeKind.LogicalLiteral:
            return `LL|${type.isNullable ? 1 : 0}|${(type as Type.LogicalLiteral).normalizedLiteral}`;

        case PQP.Language.Type.ExtendedTypeKind.NumberLiteral:
            return `NL|${type.isNullable ? 1 : 0}|${(type as Type.NumberLiteral).normalizedLiteral}`;

        case PQP.Language.Type.ExtendedTypeKind.TextLiteral:
            return `TL|${type.isNullable ? 1 : 0}|${(type as Type.TextLiteral).normalizedLiteral}`;

        case PQP.Language.Type.ExtendedTypeKind.DefinedRecord:
            return definedRecordKey(type as Type.DefinedRecord);

        case PQP.Language.Type.ExtendedTypeKind.DefinedTable:
            return definedTableKey(type as Type.DefinedTable);

        case PQP.Language.Type.ExtendedTypeKind.DefinedFunction:
            return definedFunctionKey(type as Type.DefinedFunction);

        case PQP.Language.Type.ExtendedTypeKind.DefinedList:
            return definedListKey(type as Type.DefinedList);

        case PQP.Language.Type.ExtendedTypeKind.DefinedListType:
            return definedListTypeKey(type as Type.DefinedListType);

        case PQP.Language.Type.ExtendedTypeKind.AnyUnion:
            return anyUnionKey(type as Type.AnyUnion);

        case PQP.Language.Type.ExtendedTypeKind.FunctionType:
            return functionTypeKey(type as Type.FunctionType);

        case PQP.Language.Type.ExtendedTypeKind.ListType:
            return `LT|${type.isNullable ? 1 : 0}|${typeToKey((type as Type.ListType).itemType)}`;

        case PQP.Language.Type.ExtendedTypeKind.PrimaryPrimitiveType:
            return `PPT|${type.isNullable ? 1 : 0}|${(type as Type.PrimaryPrimitiveType).primitiveType.kind}`;

        case PQP.Language.Type.ExtendedTypeKind.RecordType:
            return recordTypeKey(type as Type.RecordType);

        case PQP.Language.Type.ExtendedTypeKind.TableType:
            return tableTypeKey(type as Type.TableType);

        case PQP.Language.Type.ExtendedTypeKind.TableTypePrimaryExpression:
            return `TTPE|${type.isNullable ? 1 : 0}|${typeToKey((type as Type.TableTypePrimaryExpression).primaryExpression)}`;

        default: {
            // Fallback for any future extended types
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fallback: any = type;

            return `?|${fallback.kind}|${fallback.extendedKind}|${fallback.isNullable ? 1 : 0}`;
        }
    }
}

function definedRecordKey(type: Type.DefinedRecord): string {
    // Fields are unordered (Map), so sort keys for canonical form
    const fieldKeys: string[] = [];

    for (const [name, fieldType] of type.fields) {
        fieldKeys.push(`${name}:${typeToKey(fieldType)}`);
    }

    fieldKeys.sort();

    return `DR|${type.isNullable ? 1 : 0}|${type.isOpen ? 1 : 0}|{${fieldKeys.join(",")}}`;
}

function definedTableKey(type: Type.DefinedTable): string {
    // Tables use OrderedMap — order matters for equality
    const fieldKeys: string[] = [];

    for (const [name, fieldType] of type.fields) {
        fieldKeys.push(`${name}:${typeToKey(fieldType)}`);
    }

    // OrderedMap preserves insertion order — don't sort
    return `DT|${type.isNullable ? 1 : 0}|${type.isOpen ? 1 : 0}|[${fieldKeys.join(",")}]`;
}

function definedFunctionKey(type: Type.DefinedFunction): string {
    const params = type.parameters
        .map((p) => `${p.nameLiteral}:${p.type ?? "_"}:${p.isNullable ? 1 : 0}:${p.isOptional ? 1 : 0}`)
        .join(";");

    return `DF|${type.isNullable ? 1 : 0}|(${params})->${typeToKey(type.returnType)}`;
}

function definedListKey(type: Type.DefinedList): string {
    const elements = type.elements.map(typeToKey).join(",");

    return `DL|${type.isNullable ? 1 : 0}|[${elements}]`;
}

function definedListTypeKey(type: Type.DefinedListType): string {
    const items = type.itemTypes.map(typeToKey).join(",");

    return `DLT|${type.isNullable ? 1 : 0}|[${items}]`;
}

function anyUnionKey(type: Type.AnyUnion): string {
    // Union equality is order-independent — sort member keys
    const memberKeys = type.unionedTypePairs.map(typeToKey);
    memberKeys.sort();

    return `U|${type.isNullable ? 1 : 0}|{${memberKeys.join("|")}}`;
}

function functionTypeKey(type: Type.FunctionType): string {
    const params = type.parameters
        .map((p) => `${p.nameLiteral}:${p.type ?? "_"}:${p.isNullable ? 1 : 0}:${p.isOptional ? 1 : 0}`)
        .join(";");

    return `FT|${type.isNullable ? 1 : 0}|(${params})->${typeToKey(type.returnType)}`;
}

function recordTypeKey(type: Type.RecordType): string {
    const fieldKeys: string[] = [];

    for (const [name, fieldType] of type.fields) {
        fieldKeys.push(`${name}:${typeToKey(fieldType)}`);
    }

    fieldKeys.sort();

    return `RT|${type.isNullable ? 1 : 0}|${type.isOpen ? 1 : 0}|{${fieldKeys.join(",")}}`;
}

function tableTypeKey(type: Type.TableType): string {
    const fieldKeys: string[] = [];

    for (const [name, fieldType] of type.fields) {
        fieldKeys.push(`${name}:${typeToKey(fieldType)}`);
    }

    fieldKeys.sort();

    return `TT|${type.isNullable ? 1 : 0}|${type.isOpen ? 1 : 0}|{${fieldKeys.join(",")}}`;
}

// --- Type Intern Table ---

/**
 * An intern table that deduplicates types by structural equality.
 * After interning, reference equality (===) is sufficient for comparison.
 */
export class TypeInternTable {
    private readonly keyToType: Map<string, Type.TPowerQueryType> = new Map();

    /** Intern a type: returns the canonical instance for structurally equal types. */
    public intern(type: Type.TPowerQueryType): Type.TPowerQueryType {
        const key = typeToKey(type);
        const existing = this.keyToType.get(key);

        if (existing !== undefined) {
            return existing;
        }

        this.keyToType.set(key, type);

        return type;
    }

    /** Check if a structurally equal type has already been interned. */
    public has(type: Type.TPowerQueryType): boolean {
        return this.keyToType.has(typeToKey(type));
    }

    /** Get the canonical instance (or undefined). */
    public get(type: Type.TPowerQueryType): Type.TPowerQueryType | undefined {
        return this.keyToType.get(typeToKey(type));
    }

    public get size(): number {
        return this.keyToType.size;
    }

    public clear(): void {
        this.keyToType.clear();
    }
}

// --- Fast AnyUnion: O(n) deduplication via hashing ---

/**
 * A faster alternative to TypeUtils.anyUnion() that pre-deduplicates using
 * canonical keys before (optionally) delegating to the real simplify pipeline.
 *
 * For most cases this avoids the O(n²) ImmutableSet path entirely.
 */
export function fastAnyUnion(
    types: ReadonlyArray<Type.TPowerQueryType>,
    _traceManager: PQP.Trace.TraceManager,
    _correlationId: number,
): Type.TPowerQueryType {
    if (types.length === 0) {
        return PQP.Language.Type.AnyInstance;
    }

    if (types.length === 1) {
        return types[0];
    }

    // O(n) deduplication using canonical keys
    const seen = new Map<string, Type.TPowerQueryType>();

    for (const type of types) {
        // Quick reference check for singletons (avoids key computation)
        if (type === PQP.Language.Type.AnyInstance) {
            // If `any` is in the union, the whole union collapses to `any`
            return PQP.Language.Type.AnyInstance;
        }

        const key = typeToKey(type);

        if (!seen.has(key)) {
            seen.set(key, type);
        }
    }

    if (seen.size === 1) {
        return seen.values().next().value!;
    }

    // Check for primitive subsumption: if `number` is present, remove NumberLiterals etc.
    const deduped = applyPrimitiveSubsumption(seen);

    if (deduped.length === 1) {
        return deduped[0];
    }

    // Build the AnyUnion directly (skip the O(n²) simplify/categorize pipeline)
    const isNullable = deduped.some((t) => t.isNullable);

    return {
        kind: PQP.Language.Type.TypeKind.Any,
        extendedKind: PQP.Language.Type.ExtendedTypeKind.AnyUnion,
        isNullable,
        unionedTypePairs: deduped,
    };
}

/**
 * Applies primitive subsumption rules:
 * - If `number` primitive exists, remove all NumberLiteral members
 * - If `text` primitive exists, remove all TextLiteral members
 * - If `logical` primitive exists, remove all LogicalLiteral members
 * - If both `true` and `false` LogicalLiterals exist, collapse to `logical`
 */
function applyPrimitiveSubsumption(seen: Map<string, Type.TPowerQueryType>): Type.TPowerQueryType[] {
    const result: Type.TPowerQueryType[] = [];
    const hasNumberPrimitive = seen.has("Number|0") || seen.has("Number|1");
    const hasTextPrimitive = seen.has("Text|0") || seen.has("Text|1");
    const hasLogicalPrimitive = seen.has("Logical|0") || seen.has("Logical|1");

    // Check for true|false → logical collapse
    let collapseLogicalLiterals = false;

    if (!hasLogicalPrimitive) {
        const hasTrue = seen.has("LL|0|true") || seen.has("LL|1|true");
        const hasFalse = seen.has("LL|0|false") || seen.has("LL|1|false");

        if (hasTrue && hasFalse) {
            collapseLogicalLiterals = true;
        }
    }

    for (const [key, type] of seen) {
        // Skip NumberLiterals if number primitive exists
        if (hasNumberPrimitive && key.startsWith("NL|")) {
            continue;
        }

        // Skip TextLiterals if text primitive exists
        if (hasTextPrimitive && key.startsWith("TL|")) {
            continue;
        }

        // Skip LogicalLiterals if logical primitive exists or if collapsing
        if ((hasLogicalPrimitive || collapseLogicalLiterals) && key.startsWith("LL|")) {
            continue;
        }

        result.push(type);
    }

    // If we collapsed logical literals, add the logical primitive
    if (collapseLogicalLiterals) {
        result.push(PQP.Language.Type.LogicalInstance);
    }

    return result;
}

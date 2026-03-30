// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Constant, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export interface TypeDirective {
    readonly kind: "Type";
    readonly value?: string;
}

// Type for the async resolver function that resolves a scope item to its type.
type ScopeItemTypeResolver = (scopeItem: TScopeItem) => Promise<Type.TPowerQueryType>;

/**
 * Maps scope identifier keys to their resolved Power Query types.
 *
 * Types are resolved on-demand via the async `resolveType(key)` method.
 * Call `resolveAll()` to eagerly resolve all types and get a ReadonlyMap.
 */
export class ScopeTypeByKey {
    static empty(): ScopeTypeByKey {
        return new ScopeTypeByKey(
            {
                createdForNodeId: undefined,
                scopeItemByKey: new Map(),
            },
            (_scopeItem: TScopeItem) => Promise.resolve(Type.AnyInstance),
        );
    }

    private readonly resolved: Map<string, Type.TPowerQueryType> = new Map();
    private readonly nodeScope: NodeScope;
    private readonly resolver: ScopeItemTypeResolver;

    constructor(nodeScope: NodeScope, resolver: ScopeItemTypeResolver) {
        this.nodeScope = nodeScope;
        this.resolver = resolver;
    }

    /** Returns true if the key exists in the scope (regardless of whether the type has been resolved). */
    has(key: string): boolean {
        return this.nodeScope.scopeItemByKey.has(key);
    }

    /** Returns the scope keys (all identifiers in scope, not just resolved). */
    keys(): IterableIterator<string> {
        return this.nodeScope.scopeItemByKey.keys();
    }

    /** Returns the total number of scope items (not just resolved ones). */
    get size(): number {
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
    async resolveType(key: string): Promise<Type.TPowerQueryType | undefined> {
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
    async resolveAll(): Promise<ReadonlyMap<string, Type.TPowerQueryType>> {
        // Group unresolved keys by nodeId to avoid concurrent resolution of the same node.
        // Multiple scope keys can map to the same nodeId (e.g., "foo" and '#"foo"').
        // Resolving them concurrently triggers false cycle detection in getOrCreateScopeItemType,
        // which uses a shared computingNodeIds set to break infinite recursion.
        const keysByNodeId: Map<number, string[]> = new Map();
        const firstScopeItemByNodeId: Map<number, TScopeItem> = new Map();

        for (const [key, scopeItem] of this.nodeScope.scopeItemByKey.entries()) {
            if (!this.resolved.has(key)) {
                const existing: string[] | undefined = keysByNodeId.get(scopeItem.nodeId);

                if (existing) {
                    existing.push(key);
                } else {
                    keysByNodeId.set(scopeItem.nodeId, [key]);
                    firstScopeItemByNodeId.set(scopeItem.nodeId, scopeItem);
                }
            }
        }

        // Resolve each unique nodeId once, then share the result across all keys for that nodeId.
        const nodeIds: number[] = [...keysByNodeId.keys()];

        const resolvedTypes: Type.TPowerQueryType[] = await Promise.all(
            nodeIds.map((nodeId: number) => this.resolver(firstScopeItemByNodeId.get(nodeId)!)),
        );

        for (let index: number = 0; index < nodeIds.length; index += 1) {
            for (const key of keysByNodeId.get(nodeIds[index])!) {
                this.resolved.set(key, resolvedTypes[index]);
            }
        }

        return this.resolved;
    }

    /** Resolves all types, then returns an iterator of [key, type] pairs. */
    async entries(): Promise<IterableIterator<[string, Type.TPowerQueryType]>> {
        return (await this.resolveAll()).entries();
    }

    /** Resolves all types, then returns an iterator of types. */
    async values(): Promise<IterableIterator<Type.TPowerQueryType>> {
        return (await this.resolveAll()).values();
    }

    /** Resolves all types, then calls the callback for each entry. */
    async forEach(callbackfn: (value: Type.TPowerQueryType, key: string) => void): Promise<void> {
        return (await this.resolveAll()).forEach(callbackfn);
    }
}

export type TriedNodeScope = PQP.Result<NodeScope, PQP.CommonError.CommonError>;

// Scopes for multiple nodes, where the keys are nodeIds.
// Serves as a cache when building the scope for a specific node.
export type ScopeById = Map<number, NodeScope>;

// Scope that was generated for a specific nodeId.
// Has the potential to be reused for its child nodes.
export interface NodeScope {
    readonly createdForNodeId: number | undefined;
    // Mostly a tag for debugging.
    readonly scopeItemByKey: ReadonlyMap<string, TScopeItem>;
}

export type TScopeItem =
    | EachScopeItem
    | LetVariableScopeItem
    | ParameterScopeItem
    | RecordFieldScopeItem
    | SectionMemberScopeItem
    | UndefinedScopeItem;

export type TKeyValuePairScopeItem = LetVariableScopeItem | RecordFieldScopeItem | SectionMemberScopeItem;

export enum ScopeItemKind {
    Each = "Each",
    LetVariable = "LetVariable",
    Parameter = "Parameter",
    RecordField = "RecordField",
    SectionMember = "SectionMember",
    Undefined = "Undefined",
}

export interface IScopeItem {
    readonly kind: ScopeItemKind;
    readonly nodeId: number;
    readonly isRecursive: boolean;
}

export interface IKeyValuePairScopeItem<
    Key extends Ast.Identifier | Ast.GeneralizedIdentifier,
    Kind extends ScopeItemKind.LetVariable | ScopeItemKind.RecordField | ScopeItemKind.SectionMember,
> extends IScopeItem {
    readonly kind: Kind;
    readonly key: Key;
    readonly typeDirective: TypeDirective | undefined;
    readonly value: TXorNode | undefined;
}

export interface EachScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Each;
    readonly eachExpression: TXorNode;
    // The typing used for the implicit parameter ('_').
    // Defers to eachScopeById when provided, otherwise Type.UnknownInstance.
    readonly implicitParameterType: Type.TPowerQueryType;
}

export type LetVariableScopeItem = IKeyValuePairScopeItem<Ast.Identifier, ScopeItemKind.LetVariable>;

export interface ParameterScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Parameter;
    readonly name: Ast.Identifier;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly type: Constant.PrimitiveTypeConstant | undefined;
}

export type RecordFieldScopeItem = IKeyValuePairScopeItem<Ast.GeneralizedIdentifier, ScopeItemKind.RecordField>;

export type SectionMemberScopeItem = IKeyValuePairScopeItem<Ast.Identifier, ScopeItemKind.SectionMember>;

export interface UndefinedScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Undefined;
    readonly xorNode: TXorNode;
}

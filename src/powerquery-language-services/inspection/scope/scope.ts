// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Constant, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

type ScopeItemTypeResolver = (scopeItem: TScopeItem) => Promise<Type.TPowerQueryType>;

// A scope can contain many names whose types are expensive to inspect. Most callers only need
// one or two of them, so resolving every type up front wastes work. This class keeps the complete
// set of names from NodeScope, resolves a type only when requested, and remembers the result.
//
// Different names can refer to the same syntax node, such as `foo` and `#"foo"`. resolveAll groups
// those aliases before resolving them because starting the same type inspection concurrently can
// look like recursion to the cycle detector.
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

    has(key: string): boolean {
        return this.nodeScope.scopeItemByKey.has(key);
    }

    keys(): IterableIterator<string> {
        return this.nodeScope.scopeItemByKey.keys();
    }

    get size(): number {
        return this.nodeScope.scopeItemByKey.size;
    }

    get resolvedSize(): number {
        return this.resolved.size;
    }

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

        // Aliases for the same node must reuse its resolution.
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

    async entries(): Promise<IterableIterator<[string, Type.TPowerQueryType]>> {
        return (await this.resolveAll()).entries();
    }

    async values(): Promise<IterableIterator<Type.TPowerQueryType>> {
        return (await this.resolveAll()).values();
    }

    async forEach(callbackfn: (value: Type.TPowerQueryType, key: string) => void): Promise<void> {
        return (await this.resolveAll()).forEach(callbackfn);
    }
}

export type TriedNodeScope = PQP.Result<NodeScope, PQP.CommonError.CommonError>;

// Scope that was generated for a specific nodeId.
// Has the potential to be reused for its child nodes.
export interface NodeScope {
    readonly createdForNodeId: number | undefined;
    // Mostly a tag for debugging.
    // May be a structurally shared read-only view, rather than a native Map.
    readonly scopeItemByKey: ReadonlyMap<string, TScopeItem>;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

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

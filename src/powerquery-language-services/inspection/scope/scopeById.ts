// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import type { NodeScope } from "./scope";

// Caches scopes by node ID and completed inspections for one document.
// Owned by its TypeCache (or explicitly by a standalone inspection caller).
// Scope publication and completed inspection are distinct: parents can publish child scopes
// before those children have been inspected.
export class ScopeById {
    private readonly scopes: Map<number, NodeScope> = new Map();
    private inspectedNodes: WeakSet<TXorNode["node"]> = new WeakSet();

    public get size(): number {
        return this.scopes.size;
    }

    public get(nodeId: number): NodeScope | undefined {
        return this.scopes.get(nodeId);
    }

    public has(nodeId: number): boolean {
        return this.scopes.has(nodeId);
    }

    public set(nodeId: number, scope: NodeScope): this {
        const previous: NodeScope | undefined = this.scopes.get(nodeId);

        // Adding new scopes is normal inspection work; replacing one invalidates completion.
        if (previous !== undefined && previous !== scope) {
            this.inspectedNodes = new WeakSet();
        }

        this.scopes.set(nodeId, scope);

        return this;
    }

    public delete(nodeId: number): boolean {
        const deleted: boolean = this.scopes.delete(nodeId);

        if (deleted) {
            this.inspectedNodes = new WeakSet();
        }

        return deleted;
    }

    public clear(): void {
        this.scopes.clear();
        this.inspectedNodes = new WeakSet();
    }

    public isInspectionComplete(node: TXorNode["node"]): boolean {
        return this.inspectedNodes.has(node);
    }

    public markInspectionComplete(node: TXorNode["node"]): void {
        this.inspectedNodes.add(node);
    }
}

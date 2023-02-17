// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    NodeIdMap,
    NodeIdMapUtils,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { DocumentSymbol, SymbolKind } from "./commonTypes";
import { InspectionUtils } from ".";

export function getDocumentSymbols(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    cancellationToken: PQP.ICancellationToken,
): DocumentSymbol[] {
    const currentSymbols: DocumentSymbol[] = [];
    const parentSymbolById: Map<number, DocumentSymbol> = new Map();

    addIdentifierPairedExpressionSymbols(nodeIdMapCollection, currentSymbols, parentSymbolById, cancellationToken);
    addRecordSymbols(nodeIdMapCollection, currentSymbols, parentSymbolById, cancellationToken);

    return currentSymbols;
}

function addIdentifierPairedExpressionSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    currentSymbols: DocumentSymbol[],
    parentSymbolById: Map<number, DocumentSymbol>,
    cancellationToken: PQP.ICancellationToken,
): void {
    const identifierPairedExpressionIds: Set<number> =
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.IdentifierPairedExpression) ?? new Set();

    for (const nodeId of identifierPairedExpressionIds) {
        cancellationToken.throwIfCancelled();

        const xorNode: XorNode<Ast.IdentifierPairedExpression> =
            NodeIdMapUtils.assertGetXorChecked<Ast.IdentifierPairedExpression>(
                nodeIdMapCollection,
                nodeId,
                Ast.NodeKind.IdentifierPairedExpression,
            );

        if (!XorNodeUtils.isAstXor(xorNode)) {
            continue;
        }

        const astNode: Ast.IdentifierPairedExpression = xorNode.node;
        const documentSymbol: DocumentSymbol = InspectionUtils.getSymbolForIdentifierPairedExpression(astNode);
        addDocumentSymbols(nodeIdMapCollection, parentSymbolById, nodeId, currentSymbols, documentSymbol);
        parentSymbolById.set(nodeId, documentSymbol);
    }
}

function addRecordSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    currentSymbols: DocumentSymbol[],
    parentSymbolById: Map<number, DocumentSymbol>,
    cancellationToken: PQP.ICancellationToken,
): void {
    const recordIdCollections: ReadonlyArray<Set<number>> = [
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression) ?? new Set(),
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordLiteral) ?? new Set(),
    ];

    for (const collection of recordIdCollections) {
        for (const nodeId of collection) {
            cancellationToken.throwIfCancelled();

            const xorNode: XorNode<Ast.RecordExpression | Ast.RecordLiteral> = NodeIdMapUtils.assertGetXorChecked<
                Ast.RecordExpression | Ast.RecordLiteral
            >(nodeIdMapCollection, nodeId, [Ast.NodeKind.RecordExpression, Ast.NodeKind.RecordLiteral]);

            if (!XorNodeUtils.isAstXor(xorNode)) {
                continue;
            }

            const astNode: Ast.RecordExpression | Ast.RecordLiteral = xorNode.node;

            // Process the record if the immediate parent is a Struct
            const parentId: number | undefined = nodeIdMapCollection.parentIdById.get(astNode.id);
            const parentSymbol: DocumentSymbol | undefined = parentId ? parentSymbolById.get(parentId) : undefined;

            if (parentSymbol && parentSymbol.kind === SymbolKind.Struct) {
                const fieldSymbols: ReadonlyArray<DocumentSymbol> = InspectionUtils.getSymbolsForRecord(astNode);

                if (fieldSymbols.length > 0) {
                    addDocumentSymbols(
                        nodeIdMapCollection,
                        parentSymbolById,
                        astNode.id,
                        currentSymbols,
                        ...fieldSymbols,
                    );
                }
            }
        }
    }
}

function addDocumentSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentSymbolById: Map<number, DocumentSymbol>,
    nodeId: number,
    currentSymbols: DocumentSymbol[],
    ...newSymbols: DocumentSymbol[]
): void {
    const parentSymbol: DocumentSymbol | undefined = findParentSymbol(nodeIdMapCollection, parentSymbolById, nodeId);

    if (parentSymbol) {
        if (!parentSymbol.children) {
            parentSymbol.children = [];
        }

        parentSymbol.children.push(...newSymbols);

        return;
    }

    // Add to the top level
    currentSymbols.push(...newSymbols);
}

function findParentSymbol(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentSymbolById: Map<number, DocumentSymbol>,
    nodeId: number,
): DocumentSymbol | undefined {
    // Get parent for current node
    const parentNodeId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);

    if (!parentNodeId) {
        // No more parents to check
        return undefined;
    }

    let parentSymbol: DocumentSymbol | undefined = parentSymbolById.get(parentNodeId);

    if (!parentSymbol) {
        parentSymbol = findParentSymbol(nodeIdMapCollection, parentSymbolById, parentNodeId);
    }

    return parentSymbol;
}

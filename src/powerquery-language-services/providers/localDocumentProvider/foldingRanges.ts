// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { type Trace, type TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { type FoldingRange } from "vscode-languageserver-types";
import { type TokenRange } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/token";

import { ProviderTraceConstant } from "../../trace";

export function createFoldingRanges(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): FoldingRange[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        createFoldingRanges.name,
        correlationId,
    );

    let foldingRanges: FoldingRange[] = [];

    foldingRanges = foldingRanges
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.FunctionExpression, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.IfExpression, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.InvokeExpression, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.LetExpression, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.ListExpression, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.ListLiteral, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.MetadataExpression, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.RecordExpression, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.RecordLiteral, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.SectionMember, traceManager, trace.id))
        .concat(getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.TypePrimaryType, traceManager, trace.id));

    trace.exit();

    return foldingRanges;
}

function getFoldingRanges<T extends Ast.TNode>(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeKind: T["kind"],
    traceManager: TraceManager,
    correlationId: number,
): FoldingRange[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getFoldingRanges.name,
        correlationId,
        { nodeKind },
    );

    const foldingRanges: FoldingRange[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(nodeKind) ?? []) {
        const node: T | undefined = NodeIdMapUtils.astChecked<T>(nodeIdMapCollection, nodeId, nodeKind);

        if (node === undefined) {
            continue;
        }

        const tokenRange: TokenRange = node.tokenRange;

        if (tokenRange.positionStart.lineNumber !== tokenRange.positionEnd.lineNumber) {
            foldingRanges.push(asFoldingRange(tokenRange));
        }
    }

    trace.exit();

    return foldingRanges;
}

function asFoldingRange(tokenRange: TokenRange): FoldingRange {
    return {
        startCharacter: tokenRange.positionStart.lineCodeUnit,
        startLine: tokenRange.positionStart.lineNumber,
        endCharacter: tokenRange.positionEnd.lineCodeUnit,
        endLine: tokenRange.positionEnd.lineNumber,
    };
}

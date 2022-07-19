// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { FoldingRange } from "vscode-languageserver-types";
import { ICancellationToken } from "@microsoft/powerquery-parser";
import { TokenRange } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/token";

import { ProviderTraceConstant } from "../../trace";

export function createFoldingRanges(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken,
): FoldingRange[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        createFoldingRanges.name,
        correlationId,
    );

    cancellationToken?.throwIfCancelled();

    let foldingRanges: FoldingRange[] = [];

    foldingRanges = foldingRanges
        .concat(
            getFoldingRanges(
                nodeIdMapCollection,
                Ast.NodeKind.FunctionExpression,
                traceManager,
                trace.id,
                cancellationToken,
            ),
        )
        .concat(
            getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.IfExpression, traceManager, trace.id, cancellationToken),
        )
        .concat(
            getFoldingRanges(
                nodeIdMapCollection,
                Ast.NodeKind.InvokeExpression,
                traceManager,
                trace.id,
                cancellationToken,
            ),
        )
        .concat(
            getFoldingRanges(
                nodeIdMapCollection,
                Ast.NodeKind.LetExpression,
                traceManager,
                trace.id,
                cancellationToken,
            ),
        )
        .concat(
            getFoldingRanges(
                nodeIdMapCollection,
                Ast.NodeKind.ListExpression,
                traceManager,
                trace.id,
                cancellationToken,
            ),
        )
        .concat(
            getFoldingRanges(nodeIdMapCollection, Ast.NodeKind.ListLiteral, traceManager, trace.id, cancellationToken),
        )
        .concat(
            getFoldingRanges(
                nodeIdMapCollection,
                Ast.NodeKind.MetadataExpression,
                traceManager,
                trace.id,
                cancellationToken,
            ),
        )
        .concat(
            getFoldingRanges(
                nodeIdMapCollection,
                Ast.NodeKind.RecordExpression,
                traceManager,
                trace.id,
                cancellationToken,
            ),
        )
        .concat(
            getFoldingRanges(
                nodeIdMapCollection,
                Ast.NodeKind.RecordLiteral,
                traceManager,
                trace.id,
                cancellationToken,
            ),
        )
        .concat(
            getFoldingRanges(
                nodeIdMapCollection,
                Ast.NodeKind.SectionMember,
                traceManager,
                trace.id,
                cancellationToken,
            ),
        )
        .concat(
            getFoldingRanges(
                nodeIdMapCollection,
                Ast.NodeKind.TypePrimaryType,
                traceManager,
                trace.id,
                cancellationToken,
            ),
        );

    trace.exit();

    return foldingRanges;
}

function getFoldingRanges<T extends Ast.TNode>(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeKind: T["kind"],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken,
): FoldingRange[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getFoldingRanges.name,
        correlationId,
        { nodeKind },
    );

    cancellationToken?.throwIfCancelled();

    const foldingRanges: FoldingRange[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(nodeKind) ?? []) {
        const maybeNode: T | undefined = NodeIdMapUtils.maybeUnboxIfAstChecked<T>(
            nodeIdMapCollection,
            nodeId,
            nodeKind,
        );

        if (maybeNode === undefined) {
            continue;
        }

        const tokenRange: TokenRange = maybeNode.tokenRange;

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

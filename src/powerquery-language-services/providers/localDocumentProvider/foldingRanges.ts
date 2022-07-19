// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, ICancellationToken, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { FoldingRange } from "vscode-languageserver-types";
import { TokenRange } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/token";

import { ProviderTraceConstant } from "../../trace";

export function tryCreateFoldingRanges(
    nodeIdMapCollection: NodeIdMap.Collection,
    locale: string,
    traceManager: TraceManager,
    correlationId: number,
    maybeCancellationToken: ICancellationToken | undefined,
): Promise<Result<FoldingRange[], CommonError.CommonError>> {
    return ResultUtils.ensureResultAsync(
        async () => await createFoldingRanges(nodeIdMapCollection, traceManager, correlationId, maybeCancellationToken),
        locale,
    );
}

async function createFoldingRanges(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
    maybeCancellationToken: ICancellationToken | undefined,
): Promise<FoldingRange[]> {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        createFoldingRanges.name,
        correlationId,
    );

    maybeCancellationToken?.throwIfCancelled();

    let foldingRanges: FoldingRange[] = [];

    foldingRanges = foldingRanges
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.FunctionExpression,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.IfExpression,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.InvokeExpression,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.LetExpression,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.ListExpression,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.ListLiteral,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.MetadataExpression,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.RecordExpression,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.RecordLiteral,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.SectionMember,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        )
        .concat(
            await getFoldingRangesFor(
                nodeIdMapCollection,
                Ast.NodeKind.TypePrimaryType,
                traceManager,
                trace.id,
                maybeCancellationToken,
            ),
        );

    trace.exit();

    return foldingRanges;
}

function getFoldingRangesFor<T extends Ast.TNode>(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeKind: T["kind"],
    traceManager: TraceManager,
    correlationId: number,
    maybeCancellationToken: ICancellationToken | undefined,
): Promise<FoldingRange[]> {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getFoldingRangesFor.name,
        correlationId,
        { nodeKind },
    );

    maybeCancellationToken?.throwIfCancelled();

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

    return Promise.resolve(foldingRanges);
}

function asFoldingRange(tokenRange: TokenRange): FoldingRange {
    return {
        startCharacter: tokenRange.positionStart.lineCodeUnit,
        startLine: tokenRange.positionStart.lineNumber,
        endCharacter: tokenRange.positionEnd.lineCodeUnit,
        endLine: tokenRange.positionEnd.lineNumber,
    };
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ICancellationToken } from "@microsoft/powerquery-parser";
import {
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageserver-types";
import { Trace, TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { Library, PositionUtils } from "../..";
import { PartialSemanticToken } from "../commonTypes";
import { ProviderTraceConstant } from "../../trace";

export function createPartialSemanticTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    libraryDefinitions: Library.LibraryDefinitions,
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        createPartialSemanticTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    // Consumed as first-come first-serve priority.
    getAsNullablePrimitiveTypeTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getEachExpressionTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getFieldSelectorTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getFieldProjectionTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getFieldSpecificationTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);

    getGeneralizedIdentifierPairedAnyLiteralTokens(
        nodeIdMapCollection,
        tokens,
        traceManager,
        trace.id,
        cancellationToken,
    );

    getGeneralizedIdentifierPairedExpressionTokens(
        nodeIdMapCollection,
        tokens,
        traceManager,
        trace.id,
        cancellationToken,
    );

    getIdentifierPairedExpressionTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getIfExpressionTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getInvokeExpressionTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getLetExpressionTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getLiteralTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getNullablePrimitiveTypeTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getNullableTypeTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getParameterTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getPrimitiveTypeTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getTBinOpExpressionTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getTableTypeTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);
    getTypePrimaryTypeTokens(nodeIdMapCollection, tokens, traceManager, trace.id, cancellationToken);

    // Should be the lowest priority
    getIdentifierExpressionTokens(
        nodeIdMapCollection,
        libraryDefinitions,
        tokens,
        traceManager,
        trace.id,
        cancellationToken,
    );

    trace.exit();

    return tokens;
}

function getAsNullablePrimitiveTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getAsNullablePrimitiveTypeTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.AsNullablePrimitiveType) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.keyword);
    }

    trace.exit();
}

function getEachExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getEachExpressionTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.EachExpression) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.keyword);
    }

    trace.exit();
}

function getFieldSelectorTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getFieldSelectorTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.FieldSelector) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(
            nodeIdMapCollection,
            nodeId,
            Ast.NodeKind.GeneralizedIdentifier,
            1,
            tokens,
            SemanticTokenTypes.variable,
        );

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 3, tokens, SemanticTokenTypes.operator);
    }

    trace.exit();
}

function getFieldProjectionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getFieldProjectionTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.FieldProjection) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 3, tokens, SemanticTokenTypes.operator);
    }

    trace.exit();
}

function getFieldSpecificationTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getFieldSpecificationTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.FieldSpecification) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.keyword);
    }

    trace.exit();
}

function getGeneralizedIdentifierPairedExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    getPairedExpressionTokens<Ast.GeneralizedIdentifierPairedExpression>(
        nodeIdMapCollection,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.NodeKind.GeneralizedIdentifier,
        tokens,
        traceManager,
        correlationId,
        cancellationToken,
    );
}

function getGeneralizedIdentifierPairedAnyLiteralTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    getPairedExpressionTokens<Ast.GeneralizedIdentifierPairedAnyLiteral>(
        nodeIdMapCollection,
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
        Ast.NodeKind.GeneralizedIdentifier,
        tokens,
        traceManager,
        correlationId,
        cancellationToken,
    );
}

function getIdentifierExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    libraryDefinitions: Library.LibraryDefinitions,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getIdentifierExpressionTokens.name,
        correlationId,
    );

    for (const identifierId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.IdentifierExpression) ?? []) {
        cancellationToken?.throwIfCancelled();

        const identifierExpr: Ast.IdentifierExpression | undefined = nodeIdMapCollection.astNodeById.get(
            identifierId,
        ) as Ast.IdentifierExpression | undefined;

        let tokenType: SemanticTokenTypes | undefined;
        let tokenModifiers: SemanticTokenModifiers[] = [];

        if (identifierExpr === undefined) {
            continue;
        }

        const identifier: Ast.Identifier = identifierExpr.identifier;

        switch (identifier.identifierContextKind) {
            case Ast.IdentifierContextKind.Key:
                tokenType = SemanticTokenTypes.property;
                tokenModifiers = [SemanticTokenModifiers.declaration];
                break;

            case Ast.IdentifierContextKind.Parameter:
                tokenType = SemanticTokenTypes.parameter;
                break;

            case Ast.IdentifierContextKind.Value:
                tokenType = SemanticTokenTypes.variable;

                if (libraryDefinitions.staticLibraryDefinitions.has(identifier.literal)) {
                    tokenModifiers = [SemanticTokenModifiers.defaultLibrary];
                }

                break;

            case Ast.IdentifierContextKind.Keyword:
                continue;

            default:
                throw Assert.isNever(identifier.identifierContextKind);
        }

        tokens.push({
            range: PositionUtils.rangeFromTokenRange(identifierExpr.tokenRange),
            tokenModifiers,
            tokenType,
        });
    }

    trace.exit();
}

function getIdentifierPairedExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    getPairedExpressionTokens<Ast.IdentifierPairedExpression>(
        nodeIdMapCollection,
        Ast.NodeKind.IdentifierPairedExpression,
        Ast.NodeKind.Identifier,
        tokens,
        traceManager,
        correlationId,
        cancellationToken,
    );
}

function getIfExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getIfExpressionTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.IfExpression) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.keyword);
        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 2, tokens, SemanticTokenTypes.keyword);
        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 4, tokens, SemanticTokenTypes.keyword);
    }

    trace.exit();
}

function getInvokeExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getInvokeExpressionTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.InvokeExpression) ?? []) {
        cancellationToken?.throwIfCancelled();

        const identifierXor: XorNode<Ast.IdentifierExpression> | undefined = NodeIdMapUtils.invokeExpressionIdentifier(
            nodeIdMapCollection,
            nodeId,
        );

        if (identifierXor === undefined || !XorNodeUtils.isAst(identifierXor)) {
            continue;
        }

        tokens.push({
            range: PositionUtils.rangeFromTokenRange(identifierXor.node.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.function,
        });
    }

    trace.exit();
}

function getLetExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getLetExpressionTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.LetExpression) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.keyword);
        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 2, tokens, SemanticTokenTypes.keyword);
    }

    trace.exit();
}

function getLiteralTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getLiteralTokens.name,
        correlationId,
    );

    for (const literalId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.LiteralExpression) ?? []) {
        cancellationToken?.throwIfCancelled();

        const literal: Ast.LiteralExpression | undefined = nodeIdMapCollection.astNodeById.get(literalId) as
            | Ast.LiteralExpression
            | undefined;

        let tokenType: SemanticTokenTypes | undefined;

        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (literal?.literalKind) {
            case Ast.LiteralKind.Numeric:
                tokenType = SemanticTokenTypes.number;
                break;

            case Ast.LiteralKind.Text:
                tokenType = SemanticTokenTypes.string;
                break;

            case Ast.LiteralKind.Logical:
            case Ast.LiteralKind.Null:
                tokenType = SemanticTokenTypes.keyword;
                break;

            default:
                continue;
        }

        tokens.push({
            range: PositionUtils.rangeFromTokenRange(literal.tokenRange),
            tokenModifiers: [],
            tokenType,
        });
    }

    trace.exit();
}

function getNullablePrimitiveTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getNullablePrimitiveTypeTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.NullablePrimitiveType) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.keyword);
    }

    trace.exit();
}

function getNullableTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getNullableTypeTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.NullableType) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.keyword);
    }

    trace.exit();
}

function getParameterTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getParameterTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Parameter) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.keyword);

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Identifier, 1, tokens, SemanticTokenTypes.parameter, [
            SemanticTokenModifiers.declaration,
        ]);
    }

    trace.exit();
}

function getPrimitiveTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getPrimitiveTypeTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.PrimitiveType) ?? []) {
        cancellationToken?.throwIfCancelled();

        const node: Ast.PrimitiveType | undefined = NodeIdMapUtils.astChecked<Ast.PrimitiveType>(
            nodeIdMapCollection,
            nodeId,
            Ast.NodeKind.PrimitiveType,
        );

        if (node === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.rangeFromTokenRange(node.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.type,
        });
    }

    trace.exit();
}

function getTBinOpExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getTBinOpExpressionTokens.name,
        correlationId,
    );

    const binOpExprNodeKinds: ReadonlyArray<Ast.NodeKind> = [
        Ast.NodeKind.ArithmeticExpression,
        Ast.NodeKind.AsExpression,
        Ast.NodeKind.EqualityExpression,
        Ast.NodeKind.IsExpression,
        Ast.NodeKind.LogicalExpression,
        Ast.NodeKind.MetadataExpression,
        Ast.NodeKind.NullCoalescingExpression,
        Ast.NodeKind.RelationalExpression,
    ];

    for (const nodeKind of binOpExprNodeKinds) {
        for (const binOpExprId of nodeIdMapCollection.idsByNodeKind.get(nodeKind) ?? []) {
            cancellationToken?.throwIfCancelled();

            const exprXorNode: TXorNode | undefined = NodeIdMapUtils.xor(nodeIdMapCollection, binOpExprId);

            if (exprXorNode === undefined) {
                continue;
            }

            const operatorNode: Ast.TConstant | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                exprXorNode.node.id,
                1,
                Ast.NodeKind.Constant,
            );

            if (operatorNode === undefined) {
                continue;
            }

            const tokenType: SemanticTokenTypes = [
                Ast.NodeKind.AsExpression,
                Ast.NodeKind.IsExpression,
                Ast.NodeKind.MetadataExpression,
            ].includes(exprXorNode.node.kind)
                ? SemanticTokenTypes.keyword
                : SemanticTokenTypes.operator;

            tokens.push({
                range: PositionUtils.rangeFromTokenRange(operatorNode.tokenRange),
                tokenModifiers: [],
                tokenType,
            });
        }
    }

    trace.exit();
}

function getTableTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getTableTypeTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.TableType) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.type);
    }

    trace.exit();
}

function getTypePrimaryTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getTypePrimaryTypeTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.TypePrimaryType) ?? []) {
        cancellationToken?.throwIfCancelled();

        pushNthChild(nodeIdMapCollection, nodeId, Ast.NodeKind.Constant, 0, tokens, SemanticTokenTypes.type);
    }

    trace.exit();
}

function getPairedExpressionTokens<
    T extends
        | Ast.GeneralizedIdentifierPairedAnyLiteral
        | Ast.GeneralizedIdentifierPairedExpression
        | Ast.IdentifierPairedExpression,
>(
    nodeIdMapCollection: NodeIdMap.Collection,
    pairedKind: T["kind"],
    keyKind: T["key"]["kind"],
    tokens: PartialSemanticToken[],
    traceManager: TraceManager,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): void {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getPairedExpressionTokens.name,
        correlationId,
    );

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(pairedKind) ?? []) {
        cancellationToken?.throwIfCancelled();

        const keyNode: T["key"] | undefined = NodeIdMapUtils.nthChildAstChecked(
            nodeIdMapCollection,
            nodeId,
            0,
            keyKind,
        );

        if (keyNode === undefined) {
            continue;
        }

        // Distinguish function definitions from variable definitions
        const valueNode: Ast.FunctionExpression | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.FunctionExpression>(
            nodeIdMapCollection,
            nodeId,
            2,
            Ast.NodeKind.FunctionExpression,
        );

        tokens.push({
            range: PositionUtils.rangeFromTokenRange(keyNode.tokenRange),
            tokenModifiers: [SemanticTokenModifiers.declaration, SemanticTokenModifiers.readonly],
            tokenType: valueNode !== undefined ? SemanticTokenTypes.function : SemanticTokenTypes.variable,
        });
    }

    trace.exit();
}

function pushNthChild<T extends Ast.TNode>(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
    childNodeKind: T["kind"],
    attributeIndex: number,
    tokens: PartialSemanticToken[],
    tokenType: SemanticTokenTypes,
    tokenModifiers: SemanticTokenModifiers[] = [],
): void {
    const typeConstant: T | undefined = NodeIdMapUtils.nthChildAstChecked<T>(
        nodeIdMapCollection,
        parentId,
        attributeIndex,
        childNodeKind,
    );

    if (typeConstant === undefined) {
        return;
    }

    tokens.push({
        range: PositionUtils.rangeFromTokenRange(typeConstant.tokenRange),
        tokenModifiers,
        tokenType,
    });
}

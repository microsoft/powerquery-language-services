// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

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
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        createPartialSemanticTokens.name,
        correlationId,
    );

    let tokens: PartialSemanticToken[] = [];

    // Consumed as first-come first-serve priority.
    tokens = tokens
        .concat(getAsNullablePrimitiveTypeTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getFieldSelectorTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getFieldProjectionTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getFieldSpecificationTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getGeneralizedIdentifierPairedAnyLiteralTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getGeneralizedIdentifierPairedExpressionTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getIdentifierPairedExpressionTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getInvokeExpressionTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getLiteralTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getNullablePrimitiveTypeTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getNullableTypeTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getParameterTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getPrimitiveTypeTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getTBinOpExpressionTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getTableTypeTokens(nodeIdMapCollection, traceManager, trace.id))
        .concat(getTypePrimaryTypeTokens(nodeIdMapCollection, traceManager, trace.id))
        // Should be the lowest priority
        .concat(getIdentifierExpressionTokens(nodeIdMapCollection, libraryDefinitions, traceManager, trace.id));

    trace.exit();

    return tokens;
}

// TBinOpExpressions takes care of the `as` token.
// NullablePrimitiveType | PrimitiveType take care of the TNullablePrimitiveType
function getAsNullablePrimitiveTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getAsNullablePrimitiveTypeTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const parentId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.AsNullablePrimitiveType) ?? []) {
        const maybeAsNode: Ast.TConstant | undefined = NodeIdMapUtils.maybeUnboxNthChildIfAstChecked(
            nodeIdMapCollection,
            parentId,
            0,
            Ast.NodeKind.Constant,
        );

        if (maybeAsNode === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeAsNode.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.keyword,
        });
    }

    trace.exit();

    return tokens;
}

function getFieldSelectorTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getFieldSelectorTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.FieldSelector) ?? []) {
        const maybeGeneraliezdIdentifier: Ast.GeneralizedIdentifier | undefined =
            NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.GeneralizedIdentifier>(
                nodeIdMapCollection,
                nodeId,
                1,
                Ast.NodeKind.GeneralizedIdentifier,
            );

        if (maybeGeneraliezdIdentifier === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeGeneraliezdIdentifier.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.variable,
        });

        const maybeQuestionMarkAst: Ast.TConstant | undefined =
            NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                nodeId,
                3,
                Ast.NodeKind.Constant,
            );

        if (maybeQuestionMarkAst === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeQuestionMarkAst.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.operator,
        });
    }

    trace.exit();

    return tokens;
}

function getFieldProjectionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getFieldProjectionTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.FieldProjection) ?? []) {
        const maybeQuestionMarkNode: Ast.TConstant | undefined =
            NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                nodeId,
                3,
                Ast.NodeKind.Constant,
            );

        if (maybeQuestionMarkNode === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeQuestionMarkNode.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.operator,
        });
    }

    trace.exit();

    return tokens;
}

function getFieldSpecificationTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getFieldSpecificationTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.FieldSpecification) ?? []) {
        const maybeOptionalNode: Ast.TConstant | undefined =
            NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                nodeId,
                0,
                Ast.NodeKind.Constant,
            );

        if (maybeOptionalNode === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeOptionalNode.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.keyword,
        });
    }

    trace.exit();

    return tokens;
}

function getGeneralizedIdentifierPairedExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    return getPairedExpressionTokens<Ast.GeneralizedIdentifierPairedExpression>(
        nodeIdMapCollection,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.NodeKind.GeneralizedIdentifier,
        traceManager,
        correlationId,
    );
}

function getGeneralizedIdentifierPairedAnyLiteralTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    return getPairedExpressionTokens<Ast.GeneralizedIdentifierPairedAnyLiteral>(
        nodeIdMapCollection,
        Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
        Ast.NodeKind.GeneralizedIdentifier,
        traceManager,
        correlationId,
    );
}

function getIdentifierExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    libraryDefinitions: Library.LibraryDefinitions,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getIdentifierExpressionTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const identifierId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.IdentifierExpression) ?? []) {
        const identifierExpr: Ast.IdentifierExpression | undefined = nodeIdMapCollection.astNodeById.get(
            identifierId,
        ) as Ast.IdentifierExpression | undefined;

        let maybeTokenType: SemanticTokenTypes | undefined;
        let maybeTokenModifiers: SemanticTokenModifiers[] = [];

        switch (identifierExpr?.identifier.identifierContextKind) {
            case Ast.IdentifierContextKind.Key:
                maybeTokenType = SemanticTokenTypes.property;
                maybeTokenModifiers = [SemanticTokenModifiers.declaration];
                break;

            case Ast.IdentifierContextKind.Parameter:
                maybeTokenType = SemanticTokenTypes.parameter;
                break;

            case Ast.IdentifierContextKind.Value:
                maybeTokenType = SemanticTokenTypes.variable;

                if (libraryDefinitions.has(identifierExpr.identifier.literal)) {
                    maybeTokenModifiers = [SemanticTokenModifiers.defaultLibrary];
                }

                break;

            default:
                continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(identifierExpr.tokenRange),
            tokenModifiers: maybeTokenModifiers,
            tokenType: maybeTokenType,
        });
    }

    trace.exit();

    return tokens;
}

function getIdentifierPairedExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    return getPairedExpressionTokens<Ast.IdentifierPairedExpression>(
        nodeIdMapCollection,
        Ast.NodeKind.IdentifierPairedExpression,
        Ast.NodeKind.Identifier,
        traceManager,
        correlationId,
    );
}

function getInvokeExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getInvokeExpressionTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.InvokeExpression) ?? []) {
        const maybeIdentifierXor: XorNode<Ast.IdentifierExpression> | undefined =
            NodeIdMapUtils.maybeInvokeExpressionIdentifier(nodeIdMapCollection, nodeId);

        if (maybeIdentifierXor === undefined || !XorNodeUtils.isAstXor(maybeIdentifierXor)) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeIdentifierXor.node.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.function,
        });
    }

    trace.exit();

    return tokens;
}

function getLiteralTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getLiteralTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const literalId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.LiteralExpression) ?? []) {
        const literal: Ast.LiteralExpression | undefined = nodeIdMapCollection.astNodeById.get(literalId) as
            | Ast.LiteralExpression
            | undefined;

        let maybeTokenType: SemanticTokenTypes | undefined;

        switch (literal?.literalKind) {
            case Ast.LiteralKind.Numeric:
                maybeTokenType = SemanticTokenTypes.number;
                break;

            case Ast.LiteralKind.Text:
                maybeTokenType = SemanticTokenTypes.string;
                break;

            default:
                continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(literal.tokenRange),
            tokenModifiers: [],
            tokenType: maybeTokenType,
        });
    }

    trace.exit();

    return tokens;
}

// getPrimitiveTypeTokens takes care of primitive type token.
function getNullablePrimitiveTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getNullablePrimitiveTypeTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const parentId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.NullablePrimitiveType) ?? []) {
        const maybeNullableNode: Ast.TConstant | undefined =
            NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                parentId,
                0,
                Ast.NodeKind.Constant,
            );

        if (maybeNullableNode === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeNullableNode.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.keyword,
        });
    }

    trace.exit();

    return tokens;
}

// getPrimitiveTypeTokens takes care of primitive type token.
function getNullableTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getNullableTypeTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const parentId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.NullableType) ?? []) {
        const maybeNullableNode: Ast.TConstant | undefined =
            NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                parentId,
                0,
                Ast.NodeKind.Constant,
            );

        if (maybeNullableNode === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeNullableNode.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.keyword,
        });
    }

    trace.exit();

    return tokens;
}

// AsTypeTokens | AsNullablePrimitiveTypeTokens takes care of `maybeParameterType`
function getParameterTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getParameterTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const parameterId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Parameter) ?? []) {
        const xorNode: TXorNode = NodeIdMapUtils.assertGetXor(nodeIdMapCollection, parameterId);

        const maybeOptionalXorNode: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
            nodeIdMapCollection,
            xorNode.node.id,
            0,
        );

        if (maybeOptionalXorNode !== undefined) {
            if (!XorNodeUtils.isAstXor(maybeOptionalXorNode)) {
                continue;
            }

            tokens.push({
                range: PositionUtils.createRangeFromTokenRange(maybeOptionalXorNode.node.tokenRange),
                tokenModifiers: [],
                tokenType: SemanticTokenTypes.keyword,
            });
        }

        const maybeNameXorNode: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
            nodeIdMapCollection,
            xorNode.node.id,
            1,
        );

        if (maybeNameXorNode === undefined || !XorNodeUtils.isAstXor(maybeNameXorNode)) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeNameXorNode.node.tokenRange),
            tokenModifiers: [SemanticTokenModifiers.declaration],
            tokenType: SemanticTokenTypes.parameter,
        });
    }

    trace.exit();

    return tokens;
}

// getPrimitiveTypeTokens takes care of primitive type token.
function getPrimitiveTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getPrimitiveTypeTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.PrimitiveType) ?? []) {
        const maybeNode: Ast.PrimitiveType | undefined = NodeIdMapUtils.maybeUnboxIfAstChecked<Ast.PrimitiveType>(
            nodeIdMapCollection,
            nodeId,
            Ast.NodeKind.PrimitiveType,
        );

        if (maybeNode === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeNode.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.type,
        });
    }

    trace.exit();

    return tokens;
}

function getTBinOpExpressionTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
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

    const tokens: PartialSemanticToken[] = [];

    for (const nodeKind of binOpExprNodeKinds) {
        for (const binOpExprId of nodeIdMapCollection.idsByNodeKind.get(nodeKind) ?? []) {
            const maybeExprXorNode: TXorNode | undefined = NodeIdMapUtils.maybeXor(nodeIdMapCollection, binOpExprId);

            if (maybeExprXorNode === undefined) {
                continue;
            }

            const maybeOperatorNode: Ast.TConstant | undefined =
                NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
                    nodeIdMapCollection,
                    maybeExprXorNode.node.id,
                    1,
                    Ast.NodeKind.Constant,
                );

            if (maybeOperatorNode === undefined) {
                continue;
            }

            const tokenType: SemanticTokenTypes = [
                Ast.NodeKind.AsExpression,
                Ast.NodeKind.IsExpression,
                Ast.NodeKind.MetadataExpression,
            ].includes(maybeExprXorNode.node.kind)
                ? SemanticTokenTypes.keyword
                : SemanticTokenTypes.operator;

            tokens.push({
                range: PositionUtils.createRangeFromTokenRange(maybeOperatorNode.tokenRange),
                tokenModifiers: [],
                tokenType,
            });
        }
    }

    trace.exit();

    return tokens;
}

function getTableTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getTableTypeTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.TableType) ?? []) {
        const maybeTableConstant: Ast.TConstant | undefined =
            NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                nodeId,
                0,
                Ast.NodeKind.Constant,
            );

        if (maybeTableConstant === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeTableConstant.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.type,
        });
    }

    trace.exit();

    return tokens;
}

function getTypePrimaryTypeTokens(
    nodeIdMapCollection: NodeIdMap.Collection,
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getTypePrimaryTypeTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.TypePrimaryType) ?? []) {
        const maybeTypeConstant: Ast.TConstant | undefined =
            NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
                nodeIdMapCollection,
                nodeId,
                0,
                Ast.NodeKind.Constant,
            );

        if (maybeTypeConstant === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeTypeConstant.tokenRange),
            tokenModifiers: [],
            tokenType: SemanticTokenTypes.type,
        });
    }

    trace.exit();

    return tokens;
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
    traceManager: TraceManager,
    correlationId: number,
): PartialSemanticToken[] {
    const trace: Trace = traceManager.entry(
        ProviderTraceConstant.LocalDocumentSymbolProvider,
        getIdentifierExpressionTokens.name,
        correlationId,
    );

    const tokens: PartialSemanticToken[] = [];

    for (const nodeId of nodeIdMapCollection.idsByNodeKind.get(pairedKind) ?? []) {
        const maybeNode: T["key"] | undefined = NodeIdMapUtils.maybeUnboxNthChildIfAstChecked(
            nodeIdMapCollection,
            nodeId,
            0,
            keyKind,
        );

        if (maybeNode === undefined) {
            continue;
        }

        tokens.push({
            range: PositionUtils.createRangeFromTokenRange(maybeNode.tokenRange),
            tokenModifiers: [SemanticTokenModifiers.declaration],
            tokenType: SemanticTokenTypes.variable,
        });
    }

    trace.exit();

    return tokens;
}

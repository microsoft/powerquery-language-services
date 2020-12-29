// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { DocumentSymbol, Range, SymbolKind } from "vscode-languageserver-types";

import * as LanguageServiceUtils from "./languageServiceUtils";
import { SignatureProviderContext } from "./providers";

export function maybeSignatureProviderContext(
    inspected: PQP.Inspection.Inspection,
): SignatureProviderContext | undefined {
    if (PQP.ResultUtils.isErr(inspected.triedInvokeExpression) || inspected.triedInvokeExpression.value === undefined) {
        return undefined;
    }

    return getContextForInvokeExpression(inspected.triedInvokeExpression.value);
}

export function getContextForInvokeExpression(
    maybeExpression: PQP.Inspection.InvokeExpression,
): SignatureProviderContext | undefined {
    const functionName: string | undefined =
        maybeExpression.maybeName !== undefined ? maybeExpression.maybeName : undefined;
    const argumentOrdinal: number | undefined =
        maybeExpression.maybeArguments !== undefined ? maybeExpression.maybeArguments.argumentOrdinal : undefined;

    if (functionName !== undefined || argumentOrdinal !== undefined) {
        return {
            argumentOrdinal,
            functionName,
        };
    } else {
        return undefined;
    }
}

export function getSymbolKindForLiteralExpression(node: PQP.Language.Ast.LiteralExpression): SymbolKind {
    switch (node.literalKind) {
        case PQP.Language.Ast.LiteralKind.List:
            return SymbolKind.Array;

        case PQP.Language.Ast.LiteralKind.Logical:
            return SymbolKind.Boolean;

        case PQP.Language.Ast.LiteralKind.Null:
            return SymbolKind.Null;

        case PQP.Language.Ast.LiteralKind.Numeric:
            return SymbolKind.Number;

        case PQP.Language.Ast.LiteralKind.Text:
            return SymbolKind.String;

        default:
            return PQP.Assert.isNever(node.literalKind);
    }
}

export function getSymbolKindFromNode(node: PQP.Language.Ast.TNode | PQP.Parser.ParseContext.Node): SymbolKind {
    switch (node.kind) {
        case PQP.Language.Ast.NodeKind.Constant:
            return SymbolKind.Constant;

        case PQP.Language.Ast.NodeKind.FunctionExpression:
            return SymbolKind.Function;

        case PQP.Language.Ast.NodeKind.ListExpression:
        case PQP.Language.Ast.NodeKind.ListLiteral:
            return SymbolKind.Array;

        case PQP.Language.Ast.NodeKind.LiteralExpression:
            return getSymbolKindForLiteralExpression(node as PQP.Language.Ast.LiteralExpression);

        case PQP.Language.Ast.NodeKind.MetadataExpression:
            return SymbolKind.TypeParameter;

        case PQP.Language.Ast.NodeKind.RecordExpression:
        case PQP.Language.Ast.NodeKind.RecordLiteral:
            return SymbolKind.Struct;

        case PQP.Language.Ast.NodeKind.Section:
            return SymbolKind.Module;

        default:
            return SymbolKind.Variable;
    }
}

export function getSymbolsForLetExpression(expressionNode: PQP.Language.Ast.LetExpression): DocumentSymbol[] {
    const documentSymbols: DocumentSymbol[] = [];

    for (const element of expressionNode.variableList.elements) {
        const pairedExpression: PQP.Language.Ast.ICsv<PQP.Language.Ast.IdentifierPairedExpression> = element;
        const memberSymbol: DocumentSymbol = getSymbolForIdentifierPairedExpression(pairedExpression.node);
        documentSymbols.push(memberSymbol);
    }

    return documentSymbols;
}

export function getSymbolsForRecord(
    recordNode: PQP.Language.Ast.RecordExpression | PQP.Language.Ast.RecordLiteral,
): DocumentSymbol[] {
    const documentSymbols: DocumentSymbol[] = [];

    for (const element of recordNode.content.elements) {
        documentSymbols.push({
            kind: SymbolKind.Field,
            deprecated: false,
            name: element.node.key.literal,
            range: LanguageServiceUtils.tokenRangeToRange(element.node.tokenRange),
            selectionRange: LanguageServiceUtils.tokenRangeToRange(element.node.key.tokenRange),
        });
    }

    return documentSymbols;
}

export function getSymbolsForSection(sectionNode: PQP.Language.Ast.Section): DocumentSymbol[] {
    const documentSymbols: DocumentSymbol[] = [];

    for (const member of sectionNode.sectionMembers.elements) {
        const memberSymbol: DocumentSymbol = getSymbolForIdentifierPairedExpression(member.namePairedExpression);
        documentSymbols.push(memberSymbol);
    }

    return documentSymbols;
}

export function getSymbolForIdentifierPairedExpression(
    identifierPairedExpressionNode: PQP.Language.Ast.IdentifierPairedExpression,
): DocumentSymbol {
    return {
        kind: getSymbolKindFromNode(identifierPairedExpressionNode.value),
        deprecated: false,
        name: identifierPairedExpressionNode.key.literal,
        range: LanguageServiceUtils.tokenRangeToRange(identifierPairedExpressionNode.tokenRange),
        selectionRange: LanguageServiceUtils.tokenRangeToRange(identifierPairedExpressionNode.key.tokenRange),
    };
}

export function getSymbolsForTriedNodeScope(triedNodeScope: PQP.Inspection.TriedNodeScope): DocumentSymbol[] {
    if (PQP.ResultUtils.isErr(triedNodeScope)) {
        return [];
    }

    const documentSymbols: DocumentSymbol[] = [];
    for (const [key, scopeItem] of triedNodeScope.value.entries()) {
        let kind: SymbolKind;
        let range: Range;
        let name: string;

        switch (scopeItem.kind) {
            case PQP.Inspection.ScopeItemKind.Each: {
                if (scopeItem.eachExpression.kind !== PQP.Parser.XorNodeKind.Ast) {
                    continue;
                }

                name = key;
                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.eachExpression.node.tokenRange);
                break;
            }

            case PQP.Inspection.ScopeItemKind.KeyValuePair: {
                if (scopeItem.maybeValue === undefined) {
                    continue;
                }

                name = scopeItem.isRecursive ? `@${key}` : key;
                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.key.tokenRange);
                break;
            }

            case PQP.Inspection.ScopeItemKind.Parameter: {
                name = key;
                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.name.tokenRange);
                break;
            }

            case PQP.Inspection.ScopeItemKind.SectionMember: {
                name = scopeItem.isRecursive ? `@${key}` : key;
                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.key.tokenRange);
                break;
            }

            case PQP.Inspection.ScopeItemKind.Undefined: {
                if (scopeItem.xorNode.kind !== PQP.Parser.XorNodeKind.Ast) {
                    continue;
                }

                name = key;
                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.xorNode.node.tokenRange);
                break;
            }

            default:
                throw PQP.Assert.isNever(scopeItem);
        }

        documentSymbols.push({
            name,
            kind,
            deprecated: false,
            range,
            selectionRange: range,
        });
    }

    return documentSymbols;
}

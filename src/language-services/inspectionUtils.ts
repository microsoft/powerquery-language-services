// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { DocumentSymbol, Range, SymbolKind } from "vscode-languageserver-types";

import { SignatureProviderContext } from "./providers";
import { LanguageServiceUtils } from ".";

export function getContextForInspected(inspected: PQP.Task.InspectionOk): undefined | SignatureProviderContext {
    return inspected.maybeInvokeExpression !== undefined
        ? getContextForInvokeExpression(inspected.maybeInvokeExpression)
        : undefined;
}

export function getContextForInvokeExpression(
    maybeExpression: PQP.Inspection.InvokeExpression,
): undefined | SignatureProviderContext {
    const functionName: undefined | string =
        maybeExpression.maybeName !== undefined ? maybeExpression.maybeName : undefined;
    const argumentOrdinal: undefined | number =
        maybeExpression.maybeArguments !== undefined ? maybeExpression.maybeArguments.argumentOrdinal : undefined;

    if (functionName !== undefined || argumentOrdinal !== undefined) {
        return {
            maybeArgumentOrdinal: argumentOrdinal,
            maybeFunctionName: functionName,
        };
    } else {
        return undefined;
    }
}

export function getSymbolKindForLiteralExpression(node: PQP.Ast.LiteralExpression): SymbolKind {
    switch (node.literalKind) {
        case PQP.Ast.LiteralKind.List:
            return SymbolKind.Array;

        case PQP.Ast.LiteralKind.Logical:
            return SymbolKind.Boolean;

        case PQP.Ast.LiteralKind.Null:
            return SymbolKind.Null;

        case PQP.Ast.LiteralKind.Numeric:
            return SymbolKind.Number;

        case PQP.Ast.LiteralKind.Text:
            return SymbolKind.String;

        default:
            return PQP.isNever(node.literalKind);
    }
}

export function getSymbolKindFromNode(node: PQP.Ast.INode | PQP.ParseContext.Node): SymbolKind {
    switch (node.kind) {
        case PQP.Ast.NodeKind.Constant:
            return SymbolKind.Constant;

        case PQP.Ast.NodeKind.FunctionExpression:
            return SymbolKind.Function;

        case PQP.Ast.NodeKind.ListExpression:
        case PQP.Ast.NodeKind.ListLiteral:
            return SymbolKind.Array;

        case PQP.Ast.NodeKind.LiteralExpression:
            return getSymbolKindForLiteralExpression(node as PQP.Ast.LiteralExpression);

        case PQP.Ast.NodeKind.MetadataExpression:
            return SymbolKind.TypeParameter;

        case PQP.Ast.NodeKind.RecordExpression:
        case PQP.Ast.NodeKind.RecordLiteral:
            return SymbolKind.Struct;

        default:
            return SymbolKind.Variable;
    }
}

export function getSymbolsForLetExpression(expressionNode: PQP.Ast.LetExpression): DocumentSymbol[] {
    const documentSymbols: DocumentSymbol[] = [];

    for (const element of expressionNode.variableList.elements) {
        const pairedExpression: PQP.Ast.ICsv<PQP.Ast.IdentifierPairedExpression> = element;
        const memberSymbol: DocumentSymbol = getSymbolForIdentifierPairedExpression(pairedExpression.node);
        documentSymbols.push(memberSymbol);
    }

    return documentSymbols;
}

export function getSymbolsForSection(sectionNode: PQP.Ast.Section): DocumentSymbol[] {
    const documentSymbols: DocumentSymbol[] = [];

    for (const member of sectionNode.sectionMembers.elements) {
        const memberSymbol: DocumentSymbol = getSymbolForIdentifierPairedExpression(member.namePairedExpression);
        documentSymbols.push(memberSymbol);
    }

    return documentSymbols;
}

export function getSymbolForIdentifierPairedExpression(
    identifierPairedExpressionNode: PQP.Ast.IdentifierPairedExpression,
): DocumentSymbol {
    return {
        kind: getSymbolKindFromNode(identifierPairedExpressionNode.value),
        deprecated: false,
        name: identifierPairedExpressionNode.key.literal,
        range: LanguageServiceUtils.tokenRangeToRange(identifierPairedExpressionNode.tokenRange),
        selectionRange: LanguageServiceUtils.tokenRangeToRange(identifierPairedExpressionNode.key.tokenRange),
    };
}

export function getSymbolsForInspectionScope(inspected: PQP.Task.InspectionOk): DocumentSymbol[] {
    const documentSymbols: DocumentSymbol[] = [];

    for (const [key, scopeItem] of inspected.scope.entries()) {
        let kind: SymbolKind;
        let range: Range;

        switch (scopeItem.kind) {
            case PQP.Inspection.ScopeItemKind.Each: {
                if (scopeItem.eachExpression.kind !== PQP.XorNodeKind.Ast) {
                    continue;
                }

                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.eachExpression.node.tokenRange);
                break;
            }

            case PQP.Inspection.ScopeItemKind.KeyValuePair: {
                if (scopeItem.maybeValue === undefined) {
                    continue;
                }

                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.key.tokenRange);
                break;
            }

            case PQP.Inspection.ScopeItemKind.Parameter: {
                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.name.tokenRange);
                break;
            }

            case PQP.Inspection.ScopeItemKind.SectionMember: {
                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.key.tokenRange);
                break;
            }

            case PQP.Inspection.ScopeItemKind.Undefined: {
                if (scopeItem.xorNode.kind !== PQP.XorNodeKind.Ast) {
                    continue;
                }

                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.xorNode.node.tokenRange);
                break;
            }

            default:
                throw PQP.isNever(scopeItem);
        }

        documentSymbols.push({
            name: key,
            kind,
            deprecated: false,
            range,
            selectionRange: range,
        });
    }

    return documentSymbols;
}

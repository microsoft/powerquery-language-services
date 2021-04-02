// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import {
    CompletionItem,
    CompletionItemKind,
    DocumentSymbol,
    Range,
    SignatureHelp,
    SymbolKind,
    TextEdit,
} from "vscode-languageserver-types";

import * as LanguageServiceUtils from "./languageServiceUtils";

import { Inspection } from ".";
import { CompletionItemProviderContext, SignatureProviderContext } from "./providers/commonTypes";

export function getMaybeContextForSignatureProvider(
    inspected: Inspection.Inspection,
): SignatureProviderContext | undefined {
    if (
        PQP.ResultUtils.isError(inspected.triedInvokeExpression) ||
        inspected.triedInvokeExpression.value === undefined
    ) {
        return undefined;
    }

    const invokeExpression: Inspection.InvokeExpression = inspected.triedInvokeExpression.value;
    const functionName: string | undefined =
        invokeExpression.maybeName !== undefined ? invokeExpression.maybeName : undefined;
    const argumentOrdinal: number | undefined =
        invokeExpression.maybeArguments !== undefined ? invokeExpression.maybeArguments.argumentOrdinal : undefined;

    if (functionName !== undefined || argumentOrdinal !== undefined) {
        return {
            argumentOrdinal,
            functionName,
            isNameInLocalScope: invokeExpression.isNameInLocalScope,
            functionType: invokeExpression.functionType,
        };
    } else {
        return undefined;
    }
}

export function getMaybeSignatureHelp(context: SignatureProviderContext): SignatureHelp | null {
    const identifierLiteral: string | undefined = context.functionName;
    if (identifierLiteral === undefined || !PQP.Language.TypeUtils.isDefinedFunction(context.functionType)) {
        // tslint:disable-next-line: no-null-keyword
        return null;
    }
    const nameOfParameters: string = context.functionType.parameters
        .map(PQP.Language.TypeUtils.nameOfFunctionParameter)
        .join(", ");
    const label: string = `${identifierLiteral}(${nameOfParameters})`;

    const parameters: ReadonlyArray<PQP.Language.Type.FunctionParameter> = context.functionType.parameters;
    return {
        // tslint:disable-next-line: no-null-keyword
        activeParameter: context.argumentOrdinal ?? null,
        activeSignature: 0,
        signatures: [
            {
                label,
                parameters: parameters.map((parameter: PQP.Language.Type.FunctionParameter) => {
                    return {
                        label: parameter.nameLiteral,
                    };
                }),
            },
        ],
    };
}

export function getMaybeType(
    inspection: Inspection.Inspection,
    identifier: string,
): PQP.Language.Type.PowerQueryType | undefined {
    return PQP.ResultUtils.isOk(inspection.triedScopeType)
        ? inspection.triedScopeType.value.get(identifier)
        : undefined;
}

export function getCompletionItems(
    context: CompletionItemProviderContext,
    inspection: Inspection.Inspection,
): ReadonlyArray<CompletionItem> {
    const triedAutocompleteFieldAccess: Inspection.TriedAutocompleteFieldAccess =
        inspection.autocomplete.triedFieldAccess;
    if (PQP.ResultUtils.isError(triedAutocompleteFieldAccess) || !triedAutocompleteFieldAccess.value) {
        return [];
    }

    const text: string | null | undefined = context.text;
    const completionItems: CompletionItem[] = [];
    for (const autocompleteItem of triedAutocompleteFieldAccess.value.autocompleteItems) {
        if (!text || autocompleteItem.key.startsWith(text)) {
            let textEdit: TextEdit | undefined;
            if (!context.range) {
                textEdit = undefined;
            } else {
                textEdit = {
                    range: context.range,
                    newText: autocompleteItem.key,
                };
            }

            completionItems.push({
                kind: CompletionItemKind.Field,
                label: autocompleteItem.key,
                textEdit,
            });
        }
    }

    return completionItems;
}

export function getScopeItemKindText(scopeItemKind: Inspection.ScopeItemKind): string {
    switch (scopeItemKind) {
        case Inspection.ScopeItemKind.Each:
            return "each";

        case Inspection.ScopeItemKind.LetVariable:
            return "let-variable";

        case Inspection.ScopeItemKind.Parameter:
            return "parameter";

        case Inspection.ScopeItemKind.RecordField:
            return "record-field";

        case Inspection.ScopeItemKind.SectionMember:
            return "section-member";

        case Inspection.ScopeItemKind.Undefined:
            return "unknown";

        default:
            throw PQP.Assert.isNever(scopeItemKind);
    }
}

export function getSymbolKindFromLiteralExpression(node: PQP.Language.Ast.LiteralExpression): SymbolKind {
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

export function getSymbolKindFromNode(node: PQP.Language.Ast.INode | PQP.Parser.ParseContext.Node): SymbolKind {
    switch (node.kind) {
        case PQP.Language.Ast.NodeKind.Constant:
            return SymbolKind.Constant;

        case PQP.Language.Ast.NodeKind.FunctionExpression:
            return SymbolKind.Function;

        case PQP.Language.Ast.NodeKind.ListExpression:
        case PQP.Language.Ast.NodeKind.ListLiteral:
            return SymbolKind.Array;

        case PQP.Language.Ast.NodeKind.LiteralExpression:
            return getSymbolKindFromLiteralExpression(node as PQP.Language.Ast.LiteralExpression);

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

export function getSymbolsForLetExpression(
    expressionNode: PQP.Language.Ast.LetExpression,
): ReadonlyArray<DocumentSymbol> {
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
): ReadonlyArray<DocumentSymbol> {
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

export function getSymbolsForSection(sectionNode: PQP.Language.Ast.Section): ReadonlyArray<DocumentSymbol> {
    return sectionNode.sectionMembers.elements.map((sectionMember: PQP.Language.Ast.SectionMember) =>
        getSymbolForIdentifierPairedExpression(sectionMember.namePairedExpression),
    );
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

export function getSymbolsForInspectionScope(
    inspected: Inspection.Inspection,
    positionIdentifier: string | undefined,
): ReadonlyArray<DocumentSymbol> {
    if (PQP.ResultUtils.isError(inspected.triedNodeScope)) {
        return [];
    }

    const documentSymbols: DocumentSymbol[] = [];
    for (const [key, scopeItem] of inspected.triedNodeScope.value.entries()) {
        if (positionIdentifier && !key.startsWith(positionIdentifier)) {
            continue;
        }

        let kind: SymbolKind;
        let range: Range;
        let name: string;

        switch (scopeItem.kind) {
            case Inspection.ScopeItemKind.LetVariable:
            case Inspection.ScopeItemKind.RecordField:
            case Inspection.ScopeItemKind.SectionMember: {
                if (scopeItem.maybeValue === undefined) {
                    continue;
                }

                name = scopeItem.isRecursive ? `@${key}` : key;
                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.key.tokenRange);
                break;
            }

            case Inspection.ScopeItemKind.Each:
                continue;

            case Inspection.ScopeItemKind.Parameter: {
                name = key;
                kind = SymbolKind.Variable;
                range = LanguageServiceUtils.tokenRangeToRange(scopeItem.name.tokenRange);
                break;
            }

            case Inspection.ScopeItemKind.Undefined: {
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

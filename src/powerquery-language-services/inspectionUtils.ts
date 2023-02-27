// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { DocumentSymbol, SymbolKind } from "vscode-languageserver-types";

import { Inspection, PositionUtils } from ".";
import { InspectionSettings, TypeStrategy } from "./inspectionSettings";
import { AutocompleteItemProviderContext } from "./providers/commonTypes";
import { AutocompleteItemUtils } from "./inspection/autocomplete";
import { Library } from "./library";

export function newInspectionSettings(
    settings: PQP.Settings,
    overrides?: Partial<InspectionSettings>,
): InspectionSettings {
    return {
        ...settings,
        isWorkspaceCacheAllowed: overrides?.isWorkspaceCacheAllowed ?? true,
        library: overrides?.library ?? Library.NoOpLibrary,
        typeStrategy: overrides?.typeStrategy ?? TypeStrategy.Extended,
        eachScopeById: overrides?.eachScopeById ?? undefined,
    };
}

export async function getIdentifierType(
    inspected: Inspection.Inspected,
    identifier: string,
): Promise<Type.TPowerQueryType | undefined> {
    const triedScopeType: Inspection.TriedScopeType = await inspected.triedScopeType;

    return ResultUtils.isOk(triedScopeType) ? triedScopeType.value.get(identifier) : undefined;
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
            throw Assert.isNever(scopeItemKind);
    }
}

export function getSymbolKindFromLiteralExpression(node: Ast.LiteralExpression): SymbolKind {
    switch (node.literalKind) {
        case Ast.LiteralKind.List:
            return SymbolKind.Array;

        case Ast.LiteralKind.Logical:
            return SymbolKind.Boolean;

        case Ast.LiteralKind.Null:
            return SymbolKind.Null;

        case Ast.LiteralKind.Numeric:
            return SymbolKind.Number;

        case Ast.LiteralKind.Text:
            return SymbolKind.String;

        default:
            return Assert.isNever(node.literalKind);
    }
}

export function getSymbolKindFromNode(node: Ast.TNode): SymbolKind {
    switch (node.kind) {
        case Ast.NodeKind.Constant:
            return SymbolKind.Constant;

        case Ast.NodeKind.FunctionExpression:
            return SymbolKind.Function;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
            return SymbolKind.Array;

        case Ast.NodeKind.LiteralExpression:
            return getSymbolKindFromLiteralExpression(node);

        case Ast.NodeKind.MetadataExpression:
            return SymbolKind.TypeParameter;

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            return SymbolKind.Struct;

        case Ast.NodeKind.Section:
            return SymbolKind.Module;

        default:
            return SymbolKind.Variable;
    }
}

export function getSymbolsForLetExpression(expressionNode: Ast.LetExpression): ReadonlyArray<DocumentSymbol> {
    const documentSymbols: DocumentSymbol[] = [];

    for (const element of expressionNode.variableList.elements) {
        const pairedExpression: Ast.ICsv<Ast.IdentifierPairedExpression> = element;
        const memberSymbol: DocumentSymbol = getSymbolForIdentifierPairedExpression(pairedExpression.node);
        documentSymbols.push(memberSymbol);
    }

    return documentSymbols;
}

export function getSymbolsForRecord(
    recordNode: Ast.RecordExpression | Ast.RecordLiteral,
): ReadonlyArray<DocumentSymbol> {
    const documentSymbols: DocumentSymbol[] = [];

    for (const element of recordNode.content.elements) {
        documentSymbols.push({
            kind: SymbolKind.Field,
            deprecated: false,
            name: element.node.key.literal,
            range: PositionUtils.rangeFromTokenRange(element.node.tokenRange),
            selectionRange: PositionUtils.rangeFromTokenRange(element.node.key.tokenRange),
        });
    }

    return documentSymbols;
}

export function getSymbolsForSection(sectionNode: Ast.Section): ReadonlyArray<DocumentSymbol> {
    return sectionNode.sectionMembers.elements.map((sectionMember: Ast.SectionMember) =>
        getSymbolForIdentifierPairedExpression(sectionMember.namePairedExpression),
    );
}

export function getSymbolForIdentifierPairedExpression(
    identifierPairedExpressionNode: Ast.IdentifierPairedExpression,
): DocumentSymbol {
    return {
        kind: getSymbolKindFromNode(identifierPairedExpressionNode.value),
        deprecated: false,
        name: identifierPairedExpressionNode.key.literal,
        range: PositionUtils.rangeFromTokenRange(identifierPairedExpressionNode.tokenRange),
        selectionRange: PositionUtils.rangeFromTokenRange(identifierPairedExpressionNode.key.tokenRange),
    };
}

export function getAutocompleteItemsFromScope(
    context: AutocompleteItemProviderContext,
): ReadonlyArray<Inspection.AutocompleteItem> {
    const triedNodeScope: Inspection.TriedNodeScope = context.triedNodeScope;
    const triedScopeType: Inspection.TriedScopeType = context.triedScopeType;

    if (ResultUtils.isError(triedNodeScope)) {
        return [];
    }

    const nodeScope: Inspection.NodeScope = triedNodeScope.value;

    const scopeTypeByKey: Inspection.ScopeTypeByKey = ResultUtils.isOk(triedScopeType)
        ? triedScopeType.value
        : new Map();

    const contextText: string | undefined = context.text;
    const partial: Inspection.AutocompleteItem[] = [];

    for (const [label, scopeItem] of nodeScope.entries()) {
        const autocompleteItem: Inspection.AutocompleteItem | undefined = AutocompleteItemUtils.fromScopeItem(
            label,
            scopeItem,
            scopeTypeByKey.get(label) ?? Type.UnknownInstance,
            contextText,
        );

        if (autocompleteItem) {
            partial.push(autocompleteItem);
        }
    }

    return partial;
}

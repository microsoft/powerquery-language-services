// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { DocumentSymbol, SignatureHelp, SymbolKind } from "vscode-languageserver-types";

import { AutocompleteItemProviderContext, SignatureProviderContext } from "./providers/commonTypes";
import { Inspection, PositionUtils } from ".";
import { Trace, TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { AutocompleteItemUtils } from "./inspection/autocomplete";
import { InspectionSettings } from "./inspectionSettings";
import { InspectionTraceConstant } from "./trace";
import { Library } from "./library";
import { TypeById } from "./inspection";

export function createInspectionSettings(
    settings: PQP.Settings,
    maybeEachScopeById: TypeById | undefined,
    maybeLibrary: Library.ILibrary | undefined,
    isWorkspaceCacheAllowed: boolean,
): InspectionSettings {
    return {
        ...settings,
        library: maybeLibrary ?? Library.NoOpLibrary,
        maybeEachScopeById,
        isWorkspaceCacheAllowed,
    };
}

export async function getMaybeContextForSignatureProvider(
    inspected: Inspection.Inspected,
    traceManager: TraceManager,
    maybeCorrelationId: number | undefined,
): Promise<SignatureProviderContext | undefined> {
    const trace: Trace = traceManager.entry(
        InspectionTraceConstant.InspectionUtils,
        getMaybeContextForSignatureProvider.name,
        maybeCorrelationId,
    );

    const triedCurrentInvokeExpression: Inspection.TriedCurrentInvokeExpression =
        await inspected.triedCurrentInvokeExpression;

    if (ResultUtils.isError(triedCurrentInvokeExpression) || triedCurrentInvokeExpression.value === undefined) {
        trace.exit();

        return undefined;
    }

    const invokeExpression: Inspection.CurrentInvokeExpression = triedCurrentInvokeExpression.value;

    const functionName: string | undefined =
        invokeExpression.maybeName !== undefined ? invokeExpression.maybeName : undefined;

    const argumentOrdinal: number | undefined =
        invokeExpression.maybeArguments !== undefined ? invokeExpression.maybeArguments.argumentOrdinal : undefined;

    if (functionName !== undefined || argumentOrdinal !== undefined) {
        trace.exit();

        return {
            argumentOrdinal,
            functionName,
            isNameInLocalScope: invokeExpression.isNameInLocalScope,
            functionType: invokeExpression.functionType,
            traceManager,
            maybeInitialCorrelationId: trace.id,
        };
    } else {
        trace.exit();

        return undefined;
    }
}

export function getMaybeSignatureHelp(context: SignatureProviderContext): SignatureHelp | null {
    const identifierLiteral: string | undefined = context.functionName;

    if (identifierLiteral === undefined || !TypeUtils.isDefinedFunction(context.functionType)) {
        return null;
    }

    const nameOfParameters: string = context.functionType.parameters.map(TypeUtils.nameOfFunctionParameter).join(", ");
    const label: string = `${identifierLiteral}(${nameOfParameters})`;

    const parameters: ReadonlyArray<Type.FunctionParameter> = context.functionType.parameters;

    return {
        activeParameter: context.argumentOrdinal,
        activeSignature: 0,
        signatures: [
            {
                label,
                parameters: parameters.map((parameter: Type.FunctionParameter) => ({
                    label: parameter.nameLiteral,
                })),
            },
        ],
    };
}

export async function getMaybeType(
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
            range: PositionUtils.createRangeFromTokenRange(element.node.tokenRange),
            selectionRange: PositionUtils.createRangeFromTokenRange(element.node.key.tokenRange),
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
        range: PositionUtils.createRangeFromTokenRange(identifierPairedExpressionNode.tokenRange),
        selectionRange: PositionUtils.createRangeFromTokenRange(identifierPairedExpressionNode.key.tokenRange),
    };
}

export async function getAutocompleteItemsFromScope(
    context: AutocompleteItemProviderContext,
    inspection: Inspection.Inspected,
): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    const triedNodeScope: Inspection.TriedNodeScope = await inspection.triedNodeScope;
    const triedScopeType: Inspection.TriedScopeType = await inspection.triedScopeType;

    if (ResultUtils.isError(triedNodeScope)) {
        return [];
    }

    const nodeScope: Inspection.NodeScope = triedNodeScope.value;

    const scopeTypeByKey: Inspection.ScopeTypeByKey = ResultUtils.isOk(triedScopeType)
        ? triedScopeType.value
        : new Map();

    const maybeContextTest: string | undefined = context.text;
    const partial: Inspection.AutocompleteItem[] = [];

    for (const [label, scopeItem] of nodeScope.entries()) {
        const maybeAutocompleteItem: Inspection.AutocompleteItem | undefined =
            AutocompleteItemUtils.maybeCreateFromScopeItem(
                label,
                scopeItem,
                scopeTypeByKey.get(label) ?? Type.UnknownInstance,
                maybeContextTest,
            );

        if (maybeAutocompleteItem) {
            partial.push(maybeAutocompleteItem);
        }
    }

    return partial;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import {
    calculateJaroWinklersWithPreparedOptions,
    findJaroWinklerSuggestionWithBaseline,
    JaroWinklerScoreCache,
    PreparedJaroWinklerOption,
    prepareJaroWinklerOptions,
} from "../jaroWinkler";
import { Inspection, LibraryUtils, PositionUtils } from "..";
import { Localization, LocalizationUtils } from "../localization";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { ExternalTypeRequestKind } from "../externalType/externalType";
import { ILocalizationTemplates } from "../localization/templates";
import { TriedNodeScope } from "../inspection";
import { ValidationSettings } from "./validationSettings";
import { ValidationTraceConstant } from "../trace";

export async function validateUnknownIdentifiers(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    typeCache: Inspection.TypeCache,
): Promise<Diagnostic[]> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateUnknownIdentifiers.name,
        validationSettings.initialCorrelationId,
    );

    const updatedSettings: ValidationSettings = {
        ...validationSettings,
        initialCorrelationId: trace.id,
    };

    // Grab all identifiers in the given context.
    const identifierValues: ReadonlyArray<Ast.Identifier> = findIdentifierAsts(nodeIdMapCollection);

    const identifiersWithNodeScope: IdentifierWithNodeScope[] = [];

    // Scope inspection mutates a shared cache. Source-order evaluation lets each identifier reuse
    // completed ancestor work instead of racing other inspections over the same syntax tree.
    for (const identifier of identifierValues) {
        validationSettings.cancellationToken?.throwIfCancelled();

        const identifierExpression: Ast.IdentifierExpression | undefined =
            NodeIdMapUtils.parentAstChecked<Ast.IdentifierExpression>(
                nodeIdMapCollection,
                identifier.id,
                Ast.NodeKind.IdentifierExpression,
            );

        const literal: string =
            identifierExpression && identifierExpression.inclusiveConstant !== undefined
                ? `@${identifier.literal}`
                : identifier.literal;

        identifiersWithNodeScope.push({
            identifier: identifierExpression ?? identifier,
            literal,
            // eslint-disable-next-line no-await-in-loop
            triedNodeScope: await Inspection.tryNodeScope(
                updatedSettings,
                nodeIdMapCollection,
                updatedSettings.eachScopeById,
                identifier.id,
                typeCache.scopeById,
            ),
        });
    }

    const unknownIdentifiers: ReadonlyArray<UnknownIdentifier> = findUnknownIdentifiers(
        validationSettings,
        identifiersWithNodeScope,
        trace.id,
    );

    const result: Diagnostic[] = unknownIdentifiersToDiagnostics(updatedSettings, unknownIdentifiers);
    trace.exit();

    return result;
}

// For context, "Tbl.AsdC" has a score of ~0.59 against "Table.AddColumn"
const JaroWinklerSuggestionThreshold: number = 0.9;

interface IdentifierWithNodeScope {
    readonly identifier: Ast.Identifier | Ast.IdentifierExpression;
    readonly literal: string;
    readonly triedNodeScope: TriedNodeScope;
}

interface UnknownIdentifier {
    readonly identifier: Ast.Identifier | Ast.IdentifierExpression;
    readonly literal: string;
    readonly suggestion: string | undefined;
}

function findIdentifierAsts(nodeIdMapCollection: NodeIdMap.Collection): ReadonlyArray<Ast.Identifier> {
    const identifiers: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Identifier);

    if (identifiers === undefined) {
        return [];
    }

    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    const result: Ast.Identifier[] = [];

    for (const identifierId of identifiers.values()) {
        const identifier: Ast.Identifier | undefined = astNodeById.get(identifierId) as Ast.Identifier;

        if (identifier !== undefined && identifier.identifierContextKind === Ast.IdentifierContextKind.Value) {
            result.push(identifier);
        }
    }

    return result;
}

function findUnknownIdentifiers(
    validationSettings: ValidationSettings,
    identifiersWithNodeScope: ReadonlyArray<IdentifierWithNodeScope>,
    correlationId: number,
): ReadonlyArray<UnknownIdentifier> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        findUnknownIdentifiers.name,
        correlationId,
    );

    const unknownIdentifiers: UnknownIdentifier[] = [];

    // Compute library keys once for the entire validation run instead of per-unknown-identifier.
    const libraryKeys: ReadonlyArray<string> = LibraryUtils.getDefinitionKeys(validationSettings.library);
    const libraryOptions: ReadonlyArray<PreparedJaroWinklerOption> = prepareJaroWinklerOptions(libraryKeys);

    // Local names vary by scope, but the library is shared by every identifier in this validation.
    // Keeping them separate lets repeated misspellings reuse the expensive library-wide search.
    const libraryResultByLiteral: Map<string, [number, string]> = new Map();
    const normalizedLocalIdentifierByValue: Record<string, string> = Object.create(null);
    const scoreCache: JaroWinklerScoreCache = new JaroWinklerScoreCache();

    const suggestionByScopeMap: WeakMap<
        ReadonlyMap<string, Inspection.TScopeItem>,
        Map<string, string | undefined>
    > = new WeakMap();

    for (const identifierWithNodeScope of identifiersWithNodeScope) {
        if (ResultUtils.isError(identifierWithNodeScope.triedNodeScope)) {
            continue;
        }

        const identifier: Ast.Identifier | Ast.IdentifierExpression = identifierWithNodeScope.identifier;
        const nodeScope: Inspection.NodeScope = identifierWithNodeScope.triedNodeScope.value;
        const literal: string = identifierWithNodeScope.literal;

        if (
            !nodeScope.scopeItemByKey.has(literal) &&
            !LibraryUtils.hasDefinition(validationSettings.library, literal) &&
            !validationSettings.library.externalTypeResolver({
                kind: ExternalTypeRequestKind.Value,
                identifierLiteral: literal,
            })
        ) {
            const scopeItemByKey: ReadonlyMap<string, Inspection.TScopeItem> = nodeScope.scopeItemByKey;

            let suggestionsByLiteral: Map<string, string | undefined> | undefined =
                suggestionByScopeMap.get(scopeItemByKey);

            if (suggestionsByLiteral === undefined) {
                suggestionsByLiteral = new Map();
                suggestionByScopeMap.set(scopeItemByKey, suggestionsByLiteral);
            }

            let suggestion: string | undefined = suggestionsByLiteral.get(literal);

            if (!suggestionsByLiteral.has(literal)) {
                const normalizedLiteral: string = literal.toLowerCase();
                let libraryResult: [number, string] | undefined = libraryResultByLiteral.get(normalizedLiteral);

                if (libraryResult === undefined) {
                    libraryResult = calculateJaroWinklersWithPreparedOptions(literal, libraryOptions);
                    libraryResultByLiteral.set(normalizedLiteral, libraryResult);
                }

                suggestion = findJaroWinklerSuggestionWithBaseline(
                    literal,
                    scopeItemByKey.keys(),
                    normalizedLocalIdentifierByValue,
                    libraryResult,
                    JaroWinklerSuggestionThreshold,
                    scoreCache,
                );

                suggestionsByLiteral.set(literal, suggestion);
            }

            unknownIdentifiers.push({
                identifier,
                literal,
                suggestion,
            });
        }
    }

    trace.exit();

    return unknownIdentifiers;
}

function unknownIdentifiersToDiagnostics(
    validationSettings: ValidationSettings,
    unknownIdentifiers: ReadonlyArray<UnknownIdentifier>,
): Diagnostic[] {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(validationSettings.locale);

    return unknownIdentifiers.map((unknownIdentifier: UnknownIdentifier) => ({
        code: DiagnosticErrorCode.UnknownIdentifier,
        message: Localization.error_validation_unknownIdentifier(
            templates,
            unknownIdentifier.literal,
            unknownIdentifier.suggestion,
        ),
        range: PositionUtils.rangeFromTokenRange(unknownIdentifier.identifier.tokenRange),
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    }));
}

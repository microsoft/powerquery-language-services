// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, ResultUtils } from "@microsoft/powerquery-parser";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { Inspection, PositionUtils } from "..";
import { Localization, LocalizationUtils } from "../localization";
import { calculateJaroWinklers } from "../jaroWinkler";
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

    // For each identifier create a Promise<TriedScope>, then await on all.
    const identifiersWithNodeScope: ReadonlyArray<IdentifierWithNodeScope> = await ArrayUtils.mapAsync<
        Ast.Identifier,
        IdentifierWithNodeScope
    >(identifierValues, async (identifier: Ast.Identifier) => {
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

        return {
            identifier: identifierExpression ?? identifier,
            literal,
            triedNodeScope: await Inspection.tryNodeScope(
                updatedSettings,
                nodeIdMapCollection,
                identifier.id,
                typeCache.scopeById,
            ),
        };
    });

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

    for (const identifierWithNodeScope of identifiersWithNodeScope) {
        if (ResultUtils.isError(identifierWithNodeScope.triedNodeScope)) {
            continue;
        }

        const identifier: Ast.Identifier | Ast.IdentifierExpression = identifierWithNodeScope.identifier;
        const nodeScope: Inspection.NodeScope = identifierWithNodeScope.triedNodeScope.value;
        const literal: string = identifierWithNodeScope.literal;

        if (
            !nodeScope.has(literal) &&
            !(literal[0] === "@" && nodeScope.has(literal.slice(1))) &&
            !validationSettings.library.libraryDefinitions.has(literal) &&
            // even no external type found
            !validationSettings.library.externalTypeResolver({
                kind: ExternalTypeRequestKind.Value,
                identifierLiteral: literal,
            })
        ) {
            const knownIdentifiers: ReadonlyArray<string> = [
                ...nodeScope.keys(),
                ...validationSettings.library.libraryDefinitions.keys(),
            ];

            const [jaroWinklerScore, suggestion]: [number, string] = calculateJaroWinklers(literal, knownIdentifiers);

            unknownIdentifiers.push({
                identifier,
                literal,
                suggestion: jaroWinklerScore > JaroWinklerSuggestionThreshold ? suggestion : undefined,
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
        range: PositionUtils.createRangeFromTokenRange(unknownIdentifier.identifier.tokenRange),
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    }));
}

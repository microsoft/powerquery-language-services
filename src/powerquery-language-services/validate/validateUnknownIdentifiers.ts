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
import { ILocalizationTemplates } from "../localization/templates";
import { TriedNodeScope } from "../inspection";
import { ValidationSettings } from "./validationSettings";
import { ValidationTraceConstant } from "../trace";

// For context, "Tbl.AsdC" has a score of ~0.59 against "Table.AddColumn"
const JaroWinklerSuggestionThreshold: number = 0.9;

export async function validateUnknownIdentifiers(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    typeCache: Inspection.TypeCache,
): Promise<Diagnostic[]> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateUnknownIdentifiers.name,
        validationSettings.maybeInitialCorrelationId,
    );

    const updatedSettings: ValidationSettings = {
        ...validationSettings,
        maybeInitialCorrelationId: trace.id,
    };

    // Grab all identifiers in the value context.
    const identifierValues: ReadonlyArray<Ast.Identifier> = findIdentifierValues(nodeIdMapCollection);

    // Create a zipped collection of: [
    //  value identifier,
    //  value identifier expression | undefined (if it exists),
    //  TriedNodeScope for the value identifier
    // ]
    const identifiersAndTriedNodeScopes: ReadonlyArray<
        [Ast.Identifier, Ast.IdentifierExpression | undefined, TriedNodeScope]
    > = await ArrayUtils.mapAsync<
        Ast.Identifier,
        [Ast.Identifier, Ast.IdentifierExpression | undefined, TriedNodeScope]
    >(identifierValues, async (identifier: Ast.Identifier) => [
        identifier,
        NodeIdMapUtils.maybeParentAstChecked<Ast.IdentifierExpression>(
            nodeIdMapCollection,
            identifier.id,
            Ast.NodeKind.IdentifierExpression,
        ),
        await Inspection.tryNodeScope(updatedSettings, nodeIdMapCollection, identifier.id, typeCache.scopeById),
    ]);

    // Creates a zipped collection of: [
    //  unknown identifier | unknown identifier expression,
    //  unknown identifier literal,
    //  Jaro Winkler suggestion for the unknown literal if above a certain score threshold,
    // ]
    const unknownIdentifiers: ReadonlyArray<[Ast.Identifier | Ast.IdentifierExpression, string, string | undefined]> =
        findUnknownIdentifiers(validationSettings, identifiersAndTriedNodeScopes, trace.id);

    const result: Diagnostic[] = unknownIdentifiersToDiagnostics(updatedSettings, unknownIdentifiers);
    trace.exit();

    return result;
}

function findIdentifierValues(nodeIdMapCollection: NodeIdMap.Collection): ReadonlyArray<Ast.Identifier> {
    const maybeIdentifiers: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Identifier);

    if (maybeIdentifiers === undefined) {
        return [];
    }

    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    const result: Ast.Identifier[] = [];

    for (const identifierId of maybeIdentifiers.values()) {
        const maybeIdentifier: Ast.Identifier | undefined = astNodeById.get(identifierId) as Ast.Identifier;

        if (
            maybeIdentifier !== undefined &&
            maybeIdentifier.identifierContextKind === Ast.IdentifierContextKind.Value
        ) {
            result.push(maybeIdentifier);
        }
    }

    return result;
}

function findUnknownIdentifiers(
    validationSettings: ValidationSettings,
    identifiersAndTriedNodeScopes: ReadonlyArray<
        [Ast.Identifier, Ast.IdentifierExpression | undefined, TriedNodeScope]
    >,
    correlationId: number,
): ReadonlyArray<[Ast.Identifier | Ast.IdentifierExpression, string, string | undefined]> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        findUnknownIdentifiers.name,
        correlationId,
    );

    const unknownIdentifiers: [Ast.Identifier | Ast.IdentifierExpression, string, string | undefined][] = [];
    const numIdentifiers: number = identifiersAndTriedNodeScopes.length;

    for (let index: number = 0; index < numIdentifiers; index += 1) {
        const [identifier, maybeIdentifierExpression, triedNodeScope]: [
            Ast.Identifier,
            Ast.IdentifierExpression | undefined,
            TriedNodeScope,
        ] = identifiersAndTriedNodeScopes[index];

        if (ResultUtils.isError(triedNodeScope)) {
            continue;
        }

        const nodeScope: Inspection.NodeScope = triedNodeScope.value;

        const literal: string =
            maybeIdentifierExpression && maybeIdentifierExpression.maybeInclusiveConstant !== undefined
                ? `@${identifier.literal}`
                : identifier.literal;

        if (!nodeScope.has(literal) && !validationSettings.library.libraryDefinitions.has(literal)) {
            const knownIdentifiers: ReadonlyArray<string> = [
                ...nodeScope.keys(),
                ...validationSettings.library.libraryDefinitions.keys(),
            ];

            const [jaroWinklerScore, suggestion]: [number, string] = calculateJaroWinklers(literal, knownIdentifiers);

            unknownIdentifiers.push([
                maybeIdentifierExpression ?? identifier,
                literal,
                jaroWinklerScore > JaroWinklerSuggestionThreshold ? suggestion : undefined,
            ]);
        }
    }

    trace.exit();

    return unknownIdentifiers;
}

function unknownIdentifiersToDiagnostics(
    validationSettings: ValidationSettings,
    unknownIdentifiers: ReadonlyArray<[Ast.Identifier | Ast.IdentifierExpression, string, string | undefined]>,
): Diagnostic[] {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(validationSettings.locale);

    return unknownIdentifiers.map(
        ([identifier, literal, maybeSuggestion]: [
            Ast.Identifier | Ast.IdentifierExpression,
            string,
            string | undefined,
        ]) => ({
            code: DiagnosticErrorCode.UnknownIdentifier,
            message: Localization.error_validation_unknownIdentifier(templates, literal, maybeSuggestion),
            range: PositionUtils.createRangeFromTokenRange(identifier.tokenRange),
            severity: DiagnosticSeverity.Error,
            source: validationSettings.source,
        }),
    );
}

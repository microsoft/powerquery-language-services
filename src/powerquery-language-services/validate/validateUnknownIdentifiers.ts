// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, ResultUtils } from "@microsoft/powerquery-parser";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { Inspection, PositionUtils } from "..";
import { Localization, LocalizationUtils } from "../localization";
import { calculateJaroWinklers } from "../jaroWinkler";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { ILocalizationTemplates } from "../localization/templates";
import { TriedNodeScope } from "../inspection";
import { ValidationSettings } from "./validationSettings";

const JaroWinklerSuggestionThreshold: number = 0.5;

export async function validateUnknownIdentifiers(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    typeCache: Inspection.TypeCache,
): Promise<Diagnostic[]> {
    // Grab all identifiers in the value context.
    const identifierValues: ReadonlyArray<Ast.Identifier> = findIdentifierValues(nodeIdMapCollection);

    // Create a zipped collection of [value identifier, TriedNodeScope for the value identifier]
    const identifiersAndTriedNodeScopes: ReadonlyArray<[Ast.Identifier, TriedNodeScope]> = await ArrayUtils.mapAsync<
        Ast.Identifier,
        [Ast.Identifier, TriedNodeScope]
    >(identifierValues, async (identifier: Ast.Identifier) => [
        identifier,
        await Inspection.tryNodeScope(validationSettings, nodeIdMapCollection, identifier.id, typeCache.scopeById),
    ]);

    const unknownIdentifiers: ReadonlyArray<[Ast.Identifier, string | undefined]> =
        findUnknownIdentifiers(identifiersAndTriedNodeScopes);

    return unknownIdentifiersToDiagnostics(validationSettings, unknownIdentifiers);
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
    identifiersAndTriedNodeScopes: ReadonlyArray<[Ast.Identifier, TriedNodeScope]>,
): ReadonlyArray<[Ast.Identifier, string | undefined]> {
    const unknownIdentifiers: [Ast.Identifier, string | undefined][] = [];
    const numIdentifiers: number = identifiersAndTriedNodeScopes.length;

    for (let index: number = 0; index < numIdentifiers; index += 1) {
        const [identifier, triedNodeScope]: [Ast.Identifier, TriedNodeScope] = identifiersAndTriedNodeScopes[index];

        if (ResultUtils.isError(triedNodeScope)) {
            continue;
        }

        const nodeScope: Inspection.NodeScope = triedNodeScope.value;

        if (nodeScope && !nodeScope.has(identifier.literal)) {
            if (nodeScope.size) {
                const [jaroWinklerScore, suggestion]: [number, string] = calculateJaroWinklers(identifier.literal, [
                    ...nodeScope.keys(),
                ]);

                unknownIdentifiers.push([
                    identifier,
                    jaroWinklerScore > JaroWinklerSuggestionThreshold ? suggestion : undefined,
                ]);
            } else {
                unknownIdentifiers.push([identifier, undefined]);
            }
        }
    }

    return unknownIdentifiers;
}

function unknownIdentifiersToDiagnostics(
    validationSettings: ValidationSettings,
    unknownIdentifiers: ReadonlyArray<[Ast.Identifier, string | undefined]>,
): Diagnostic[] {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(validationSettings.locale);

    return unknownIdentifiers.map(([identifier, maybeSuggestion]: [Ast.Identifier, string | undefined]) => ({
        code: DiagnosticErrorCode.UnknownIdentifier,
        message: Localization.error_validation_unknownIdentifier(templates, identifier.literal, maybeSuggestion),
        range: PositionUtils.createRangeFromTokenRange(identifier.tokenRange),
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    }));
}

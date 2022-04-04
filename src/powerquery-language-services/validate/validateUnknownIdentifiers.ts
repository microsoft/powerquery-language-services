// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, ResultUtils } from "@microsoft/powerquery-parser";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { Inspection, PositionUtils } from "..";
import { Localization, LocalizationUtils } from "../localization";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { ILocalizationTemplates } from "../localization/templates";
import { TriedNodeScope } from "../inspection";
import { ValidationSettings } from "./validationSettings";

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

    const unknownIdentifiers: ReadonlyArray<Ast.Identifier> = findUnknownIdentifiers(identifiersAndTriedNodeScopes);

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
        const maybeIdentifier: Ast.Identifier | undefined = NodeIdMapUtils.assertUnboxAstChecked<Ast.Identifier>(
            astNodeById,
            identifierId,
            Ast.NodeKind.Identifier,
        );

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
): ReadonlyArray<Ast.Identifier> {
    const unknownIdentifiers: Ast.Identifier[] = [];
    const numIdentifiers: number = identifiersAndTriedNodeScopes.length;

    for (let index: number = 0; index < numIdentifiers; index += 1) {
        const [identifier, triedNodeScope]: [Ast.Identifier, TriedNodeScope] = identifiersAndTriedNodeScopes[index];

        if (ResultUtils.isError(triedNodeScope)) {
            continue;
        }

        const nodeScope: Inspection.NodeScope = triedNodeScope.value;

        if (nodeScope && !nodeScope.has(identifier.literal)) {
            unknownIdentifiers.push(identifier);
        }
    }

    return unknownIdentifiers;
}

function unknownIdentifiersToDiagnostics(
    validationSettings: ValidationSettings,
    unknownIdentifiers: ReadonlyArray<Ast.Identifier>,
): Diagnostic[] {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(validationSettings.locale);

    return unknownIdentifiers.map((identifier: Ast.Identifier) => ({
        code: DiagnosticErrorCode.UnknownIdentifier,
        message: Localization.error_validation_unknownIdentifier(templates, identifier.literal),
        range: PositionUtils.createRangeFromTokenRange(identifier.tokenRange),
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    }));
}

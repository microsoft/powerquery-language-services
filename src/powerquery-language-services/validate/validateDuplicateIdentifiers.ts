// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { Diagnostic, DiagnosticRelatedInformation, DocumentUri } from "vscode-languageserver-types";
import { DiagnosticSeverity } from "vscode-languageserver-types";

import * as LanguageServiceUtils from "../languageServiceUtils";

import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { Localization, LocalizationUtils } from "../localization";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { WorkspaceCacheSettings } from "../workspaceCache/workspaceCache";
import { ValidationSettings } from "./validationSettings";

export function validateDuplicateIdentifiers<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    workspaceCacheSettings: WorkspaceCacheSettings,
    validationSettings: ValidationSettings<S>,
): ReadonlyArray<Diagnostic> {
    if (!validationSettings.checkForDuplicateIdentifiers) {
        return [];
    }

    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getOrCreateParse(
        workspaceCacheSettings,
        validationSettings,
    );

    let maybeNodeIdMapCollection: PQP.Parser.NodeIdMap.Collection | undefined;
    if (PQP.TaskUtils.isParseStageOk(cacheItem)) {
        maybeNodeIdMapCollection = cacheItem.nodeIdMapCollection;
    } else if (PQP.TaskUtils.isParseStageParseError(cacheItem)) {
        maybeNodeIdMapCollection = cacheItem.nodeIdMapCollection;
    }

    if (maybeNodeIdMapCollection === undefined) {
        return [];
    }
    const documentUri: string = workspaceCacheSettings.textDocument.uri;
    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = maybeNodeIdMapCollection;

    return [
        ...validateDuplicateIdentifiersForLetExpresion(documentUri, nodeIdMapCollection, validationSettings),
        ...validateDuplicateIdentifiersForRecord(documentUri, nodeIdMapCollection, validationSettings),
        ...validateDuplicateIdentifiersForSection(documentUri, nodeIdMapCollection, validationSettings),
    ];
}

function validateDuplicateIdentifiersForLetExpresion<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    documentUri: DocumentUri,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    validationSettings: ValidationSettings<S>,
): ReadonlyArray<Diagnostic> {
    const letIds: ReadonlyArray<number> = [
        ...(nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.LetExpression) ?? []),
    ];

    return validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        letIds,
        PQP.Parser.NodeIdMapIterator.iterLetExpression,
        validationSettings,
    );
}

function validateDuplicateIdentifiersForRecord<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    documentUri: DocumentUri,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    validationSettings: ValidationSettings<S>,
): ReadonlyArray<Diagnostic> {
    const recordIds: ReadonlyArray<number> = [
        ...(nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.RecordExpression) ?? []),
        ...(nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.RecordLiteral) ?? []),
        ...(nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.RecordType) ?? []),
    ];

    return validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        recordIds,
        PQP.Parser.NodeIdMapIterator.iterRecord,
        validationSettings,
    );
}

function validateDuplicateIdentifiersForSection<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    documentUri: DocumentUri,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    validationSettings: ValidationSettings<S>,
): ReadonlyArray<Diagnostic> {
    const recordIds: ReadonlyArray<number> = [
        ...(nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.Section) ?? []),
    ];

    return validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        recordIds,
        PQP.Parser.NodeIdMapIterator.iterSection,
        validationSettings,
    );
}

// Generalized logic for iterating over some collection and their children, essentially by doing:
//  for node in nodeIds:
//      for childOfNode in iterNodeFn(node):
//          ...
function validateDuplicateIdentifiersForKeyValuePair<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    documentUri: DocumentUri,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    nodeIds: ReadonlyArray<number>,
    iterNodeFn: (
        nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
        node: PQP.Parser.TXorNode,
    ) => ReadonlyArray<PQP.Parser.NodeIdMapIterator.TKeyValuePair>,
    validationSettings: ValidationSettings<S>,
): ReadonlyArray<Diagnostic> {
    if (!nodeIds.length) {
        return [];
    }

    const result: Diagnostic[] = [];

    for (const nodeId of nodeIds) {
        const node: PQP.Parser.TXorNode = PQP.Parser.NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId);
        const duplicateFieldsByKey: Map<string, PQP.Parser.NodeIdMapIterator.TKeyValuePair[]> = new Map();
        const knownFieldByKey: Map<string, PQP.Parser.NodeIdMapIterator.TKeyValuePair> = new Map();

        for (const field of iterNodeFn(nodeIdMapCollection, node)) {
            const keyLiteral: string = field.normalizedKeyLiteral;
            const maybeDuplicateFields:
                | PQP.Parser.NodeIdMapIterator.TKeyValuePair[]
                | undefined = duplicateFieldsByKey.get(keyLiteral);
            const maybeKnownField: PQP.Parser.NodeIdMapIterator.TKeyValuePair | undefined = knownFieldByKey.get(
                keyLiteral,
            );

            if (maybeDuplicateFields) {
                maybeDuplicateFields.push(field);
            } else if (maybeKnownField) {
                duplicateFieldsByKey.set(keyLiteral, [field, maybeKnownField]);
            } else {
                knownFieldByKey.set(keyLiteral, field);
            }
        }

        for (const duplicates of duplicateFieldsByKey.values()) {
            const numFields: number = duplicates.length;
            const asRelatedInformation: DiagnosticRelatedInformation[] = duplicates.map(
                (keyValuePair: PQP.Parser.NodeIdMapIterator.TKeyValuePair) => {
                    return {
                        location: {
                            uri: documentUri,
                            range: LanguageServiceUtils.tokenRangeToRange(keyValuePair.key.tokenRange),
                        },
                        message: createDuplicateIdentifierDiagnosticMessage(keyValuePair, validationSettings),
                    };
                },
            );

            for (let index: number = 0; index < numFields; index += 1) {
                const duplicate: PQP.Parser.NodeIdMapIterator.TKeyValuePair = duplicates[index];
                // Grab all DiagnosticRelatedInformation for a given key besides the one we're iterating over.
                const relatedInformation: DiagnosticRelatedInformation[] = asRelatedInformation.filter(
                    (_: DiagnosticRelatedInformation, relatedIndex: number) => index !== relatedIndex,
                );

                result.push(createDuplicateIdentifierDiagnostic(duplicate, relatedInformation, validationSettings));
            }
        }
    }

    return result;
}

function createDuplicateIdentifierDiagnostic<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    keyValuePair: PQP.Parser.NodeIdMapIterator.TKeyValuePair,
    relatedInformation: DiagnosticRelatedInformation[],
    validationSettings: ValidationSettings<S>,
): Diagnostic {
    return {
        code: DiagnosticErrorCode.DuplicateIdentifier,
        message: createDuplicateIdentifierDiagnosticMessage(keyValuePair, validationSettings),
        range: LanguageServiceUtils.tokenRangeToRange(keyValuePair.key.tokenRange),
        relatedInformation,
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    };
}

function createDuplicateIdentifierDiagnosticMessage<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    keyValuePair: PQP.Parser.NodeIdMapIterator.TKeyValuePair,
    validationSettings: ValidationSettings<S>,
): string {
    return Localization.error_validation_duplicate_identifier(
        LocalizationUtils.getLocalizationTemplates(validationSettings?.locale ?? PQP.DefaultLocale),
        keyValuePair.keyLiteral,
    );
}

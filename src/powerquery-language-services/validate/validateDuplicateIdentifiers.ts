// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticRelatedInformation, DocumentUri } from "vscode-languageserver-types";
import { DiagnosticSeverity } from "vscode-languageserver-types";

import * as LanguageServiceUtils from "../languageServiceUtils";

import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { Localization, LocalizationUtils } from "../localization";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { ValidationOptions } from "./commonTypes";

export function validateDuplicateIdentifiers(
    document: TextDocument,
    options: ValidationOptions,
): ReadonlyArray<Diagnostic> {
    if (!options.checkForDuplicateIdentifiers) {
        return [];
    }

    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, options?.locale);

    let maybeNodeIdMapCollection: PQP.Parser.NodeIdMap.Collection | undefined;
    if (PQP.TaskUtils.isParseStageOk(cacheItem)) {
        maybeNodeIdMapCollection = cacheItem.nodeIdMapCollection;
    } else if (PQP.TaskUtils.isParseStageParseError(cacheItem)) {
        maybeNodeIdMapCollection = cacheItem.nodeIdMapCollection;
    }

    if (maybeNodeIdMapCollection === undefined) {
        return [];
    }
    const documentUri: string = document.uri;
    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = maybeNodeIdMapCollection;

    return [
        ...validateDuplicateIdentifiersForLetExpresion(documentUri, nodeIdMapCollection, options),
        ...validateDuplicateIdentifiersForRecord(documentUri, nodeIdMapCollection, options),
        ...validateDuplicateIdentifiersForSection(documentUri, nodeIdMapCollection, options),
    ];
}

function validateDuplicateIdentifiersForLetExpresion(
    documentUri: DocumentUri,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    options: ValidationOptions,
): ReadonlyArray<Diagnostic> {
    const letIds: ReadonlyArray<number> = [
        ...(nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.LetExpression) ?? []),
    ];

    return validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        letIds,
        PQP.Parser.NodeIdMapIterator.iterLetExpression,
        options,
    );
}

function validateDuplicateIdentifiersForRecord(
    documentUri: DocumentUri,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    options: ValidationOptions,
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
        options,
    );
}

function validateDuplicateIdentifiersForSection(
    documentUri: DocumentUri,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    options: ValidationOptions,
): ReadonlyArray<Diagnostic> {
    const recordIds: ReadonlyArray<number> = [
        ...(nodeIdMapCollection.idsByNodeKind.get(PQP.Language.Ast.NodeKind.Section) ?? []),
    ];

    return validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        recordIds,
        PQP.Parser.NodeIdMapIterator.iterSection,
        options,
    );
}

// Generalized logic for iterating over some collection and their children, essentially by doing:
//  for node in nodeIds:
//      for childOfNode in iterNodeFn(node):
//          ...
function validateDuplicateIdentifiersForKeyValuePair(
    documentUri: DocumentUri,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    nodeIds: ReadonlyArray<number>,
    iterNodeFn: (
        nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
        node: PQP.Parser.TXorNode,
    ) => ReadonlyArray<PQP.Parser.NodeIdMapIterator.TKeyValuePair>,
    options: ValidationOptions,
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
                        message: createDuplicateIdentifierDiagnosticMessage(keyValuePair, options),
                    };
                },
            );

            for (let index: number = 0; index < numFields; index += 1) {
                const duplicate: PQP.Parser.NodeIdMapIterator.TKeyValuePair = duplicates[index];
                // Grab all DiagnosticRelatedInformation for a given key besides the one we're iterating over.
                const relatedInformation: DiagnosticRelatedInformation[] = asRelatedInformation.filter(
                    (_: DiagnosticRelatedInformation, relatedIndex: number) => index !== relatedIndex,
                );

                result.push(createDuplicateIdentifierDiagnostic(duplicate, relatedInformation, options));
            }
        }
    }

    return result;
}

function createDuplicateIdentifierDiagnostic(
    keyValuePair: PQP.Parser.NodeIdMapIterator.TKeyValuePair,
    relatedInformation: DiagnosticRelatedInformation[],
    options: ValidationOptions,
): Diagnostic {
    return {
        code: DiagnosticErrorCode.DuplicateIdentifier,
        message: createDuplicateIdentifierDiagnosticMessage(keyValuePair, options),
        range: LanguageServiceUtils.tokenRangeToRange(keyValuePair.key.tokenRange),
        relatedInformation,
        severity: DiagnosticSeverity.Error,
        source: options.source,
    };
}

function createDuplicateIdentifierDiagnosticMessage(
    keyValuePair: PQP.Parser.NodeIdMapIterator.TKeyValuePair,
    options: ValidationOptions,
): string {
    return Localization.error_validation_duplicate_identifier(
        LocalizationUtils.getLocalizationTemplates(options?.locale ?? PQP.DefaultLocale),
        keyValuePair.keyLiteral,
    );
}

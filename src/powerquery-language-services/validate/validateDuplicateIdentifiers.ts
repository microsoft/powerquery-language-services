// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Diagnostic, DiagnosticRelatedInformation, DocumentUri } from "vscode-languageserver-types";
import {
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Localization, LocalizationUtils } from "../localization";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { PositionUtils } from "..";
import { ValidationSettings } from "./validationSettings";

export function validateDuplicateIdentifiers(
    textDocument: TextDocument,
    validationSettings: ValidationSettings,
): ReadonlyArray<Diagnostic> {
    if (!validationSettings.checkForDuplicateIdentifiers) {
        return [];
    }

    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getOrCreateParse(
        textDocument,
        validationSettings,
    );

    let maybeNodeIdMapCollection: NodeIdMap.Collection | undefined;
    if (PQP.TaskUtils.isParseStageOk(cacheItem)) {
        maybeNodeIdMapCollection = cacheItem.nodeIdMapCollection;
    } else if (PQP.TaskUtils.isParseStageParseError(cacheItem)) {
        maybeNodeIdMapCollection = cacheItem.nodeIdMapCollection;
    }

    if (maybeNodeIdMapCollection === undefined) {
        return [];
    }
    const documentUri: string = textDocument.uri;
    const nodeIdMapCollection: NodeIdMap.Collection = maybeNodeIdMapCollection;

    return [
        ...validateDuplicateIdentifiersForLetExpresion(documentUri, nodeIdMapCollection, validationSettings),
        ...validateDuplicateIdentifiersForRecord(documentUri, nodeIdMapCollection, validationSettings),
        ...validateDuplicateIdentifiersForSection(documentUri, nodeIdMapCollection, validationSettings),
    ];
}

function validateDuplicateIdentifiersForLetExpresion(
    documentUri: DocumentUri,
    nodeIdMapCollection: NodeIdMap.Collection,
    validationSettings: ValidationSettings,
): ReadonlyArray<Diagnostic> {
    const letIds: ReadonlyArray<number> = [
        ...(nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.LetExpression) ?? []),
    ];

    return validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        letIds,
        NodeIdMapIterator.iterLetExpression,
        validationSettings,
    );
}

function validateDuplicateIdentifiersForRecord(
    documentUri: DocumentUri,
    nodeIdMapCollection: NodeIdMap.Collection,
    validationSettings: ValidationSettings,
): ReadonlyArray<Diagnostic> {
    const recordIds: ReadonlyArray<number> = [
        ...(nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression) ?? []),
        ...(nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordLiteral) ?? []),
        ...(nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordType) ?? []),
    ];

    return validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        recordIds,
        NodeIdMapIterator.iterRecord,
        validationSettings,
    );
}

function validateDuplicateIdentifiersForSection(
    documentUri: DocumentUri,
    nodeIdMapCollection: NodeIdMap.Collection,
    validationSettings: ValidationSettings,
): ReadonlyArray<Diagnostic> {
    const recordIds: ReadonlyArray<number> = [...(nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Section) ?? [])];

    return validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        recordIds,
        NodeIdMapIterator.iterSection,
        validationSettings,
    );
}

// Generalized logic for iterating over some collection and their children, essentially by doing:
//  for node in nodeIds:
//      for childOfNode in iterNodeFn(node):
//          ...
function validateDuplicateIdentifiersForKeyValuePair(
    documentUri: DocumentUri,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeIds: ReadonlyArray<number>,
    iterNodeFn: (
        nodeIdMapCollection: NodeIdMap.Collection,
        node: TXorNode,
    ) => ReadonlyArray<NodeIdMapIterator.TKeyValuePair>,
    validationSettings: ValidationSettings,
): ReadonlyArray<Diagnostic> {
    if (!nodeIds.length) {
        return [];
    }

    const result: Diagnostic[] = [];

    for (const nodeId of nodeIds) {
        const node: TXorNode = NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId);
        const duplicateFieldsByKey: Map<string, NodeIdMapIterator.TKeyValuePair[]> = new Map();
        const knownFieldByKey: Map<string, NodeIdMapIterator.TKeyValuePair> = new Map();

        for (const field of iterNodeFn(nodeIdMapCollection, node)) {
            const keyLiteral: string = field.normalizedKeyLiteral;
            const maybeDuplicateFields: NodeIdMapIterator.TKeyValuePair[] | undefined =
                duplicateFieldsByKey.get(keyLiteral);
            const maybeKnownField: NodeIdMapIterator.TKeyValuePair | undefined = knownFieldByKey.get(keyLiteral);

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
                (keyValuePair: NodeIdMapIterator.TKeyValuePair) => {
                    return {
                        location: {
                            uri: documentUri,
                            range: PositionUtils.createRangeFromTokenRange(keyValuePair.key.tokenRange),
                        },
                        message: createDuplicateIdentifierDiagnosticMessage(keyValuePair, validationSettings),
                    };
                },
            );

            for (let index: number = 0; index < numFields; index += 1) {
                const duplicate: NodeIdMapIterator.TKeyValuePair = duplicates[index];
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

function createDuplicateIdentifierDiagnostic(
    keyValuePair: NodeIdMapIterator.TKeyValuePair,
    relatedInformation: DiagnosticRelatedInformation[],
    validationSettings: ValidationSettings,
): Diagnostic {
    return {
        code: DiagnosticErrorCode.DuplicateIdentifier,
        message: createDuplicateIdentifierDiagnosticMessage(keyValuePair, validationSettings),
        range: PositionUtils.createRangeFromTokenRange(keyValuePair.key.tokenRange),
        relatedInformation,
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    };
}

function createDuplicateIdentifierDiagnosticMessage(
    keyValuePair: NodeIdMapIterator.TKeyValuePair,
    validationSettings: ValidationSettings,
): string {
    return Localization.error_validation_duplicate_identifier(
        LocalizationUtils.getLocalizationTemplates(validationSettings?.locale ?? PQP.DefaultLocale),
        keyValuePair.keyLiteral,
    );
}

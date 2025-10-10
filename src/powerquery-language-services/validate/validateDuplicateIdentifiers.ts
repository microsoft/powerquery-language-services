// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Diagnostic, DiagnosticRelatedInformation, DiagnosticSeverity, DocumentUri } from "vscode-languageserver-types";
import {
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ICancellationToken } from "@microsoft/powerquery-parser";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import * as PromiseUtils from "../promiseUtils";

import { Localization, LocalizationUtils } from "../localization";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { PositionUtils } from "..";
import { ValidationSettings } from "./validationSettings";
import { ValidationTraceConstant } from "../trace";

export async function validateDuplicateIdentifiers(
    textDocument: TextDocument,
    nodeIdMapCollection: NodeIdMap.Collection,
    validationSettings: ValidationSettings,
    cancellationToken: ICancellationToken | undefined,
): Promise<Diagnostic[]> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateDuplicateIdentifiers.name,
        validationSettings.initialCorrelationId,
    );

    const updatedSettings: ValidationSettings = {
        ...validationSettings,
        initialCorrelationId: trace.id,
    };

    if (!updatedSettings.checkForDuplicateIdentifiers) {
        trace.exit();

        return [];
    }

    const documentUri: string = textDocument.uri;

    // Create an array of validation functions to process sequentially
    const validationFunctions: Array<() => Promise<ReadonlyArray<Diagnostic>>> = [
        (): Promise<ReadonlyArray<Diagnostic>> =>
            validateDuplicateIdentifiersForLetExpresion(
                documentUri,
                nodeIdMapCollection,
                updatedSettings,
                trace.id,
                cancellationToken,
            ),
        (): Promise<ReadonlyArray<Diagnostic>> =>
            validateDuplicateIdentifiersForRecord(
                documentUri,
                nodeIdMapCollection,
                updatedSettings,
                trace.id,
                cancellationToken,
            ),
        (): Promise<ReadonlyArray<Diagnostic>> =>
            validateDuplicateIdentifiersForRecordType(
                documentUri,
                nodeIdMapCollection,
                updatedSettings,
                trace.id,
                cancellationToken,
            ),
        (): Promise<ReadonlyArray<Diagnostic>> =>
            validateDuplicateIdentifiersForSection(
                documentUri,
                nodeIdMapCollection,
                updatedSettings,
                trace.id,
                cancellationToken,
            ),
    ];

    // Process all validation functions sequentially with cancellation support
    const diagnosticArrays: ReadonlyArray<Diagnostic>[] = await PromiseUtils.processSequentiallyWithCancellation(
        validationFunctions,
        (validationFunction: () => Promise<ReadonlyArray<Diagnostic>>) => validationFunction(),
        cancellationToken,
    );

    // Flatten the results
    const result: Diagnostic[] = diagnosticArrays.flat();

    trace.exit();

    return result;
}

async function validateDuplicateIdentifiersForLetExpresion(
    documentUri: DocumentUri,
    nodeIdMapCollection: NodeIdMap.Collection,
    validationSettings: ValidationSettings,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): Promise<ReadonlyArray<Diagnostic>> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateDuplicateIdentifiersForLetExpresion.name,
        correlationId,
    );

    const letIds: Set<number> = nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.LetExpression) ?? new Set();

    const result: ReadonlyArray<Diagnostic> = await validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        [letIds],
        NodeIdMapIterator.iterLetExpression,
        validationSettings,
        trace.id,
        cancellationToken,
    );

    trace.exit();

    return result;
}

async function validateDuplicateIdentifiersForRecord(
    documentUri: DocumentUri,
    nodeIdMapCollection: NodeIdMap.Collection,
    validationSettings: ValidationSettings,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): Promise<ReadonlyArray<Diagnostic>> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateDuplicateIdentifiersForRecord.name,
        correlationId,
    );

    const recordIds: ReadonlyArray<Set<number>> = [
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression) ?? new Set(),
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordLiteral) ?? new Set(),
    ];

    const result: ReadonlyArray<Diagnostic> = await validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        recordIds,
        NodeIdMapIterator.iterRecord,
        validationSettings,
        trace.id,
        cancellationToken,
    );

    trace.exit();

    return result;
}

async function validateDuplicateIdentifiersForRecordType(
    documentUri: DocumentUri,
    nodeIdMapCollection: NodeIdMap.Collection,
    validationSettings: ValidationSettings,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): Promise<ReadonlyArray<Diagnostic>> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateDuplicateIdentifiersForRecordType.name,
        correlationId,
    );

    const recordTypeIds: ReadonlyArray<Set<number>> = [
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordType) ?? new Set(),
    ];

    const result: ReadonlyArray<Diagnostic> = await validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        recordTypeIds,
        NodeIdMapIterator.iterRecordType,
        validationSettings,
        trace.id,
        cancellationToken,
    );

    trace.exit();

    return result;
}

async function validateDuplicateIdentifiersForSection(
    documentUri: DocumentUri,
    nodeIdMapCollection: NodeIdMap.Collection,
    validationSettings: ValidationSettings,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): Promise<ReadonlyArray<Diagnostic>> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateDuplicateIdentifiersForSection.name,
        correlationId,
    );

    const sectionIds: Set<number> = nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Section) ?? new Set<number>();

    const result: ReadonlyArray<Diagnostic> = await validateDuplicateIdentifiersForKeyValuePair(
        documentUri,
        nodeIdMapCollection,
        [sectionIds],
        NodeIdMapIterator.iterSection,
        validationSettings,
        trace.id,
        cancellationToken,
    );

    trace.exit();

    return result;
}

// Generalized logic for iterating over some collection and their children, essentially by doing:
//  for node in nodeIds:
//      for childOfNode in iterNodeFactory(node):
//          ...
async function validateDuplicateIdentifiersForKeyValuePair(
    documentUri: DocumentUri,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeIdCollections: ReadonlyArray<Set<number>>,
    iterNodeFactory: (
        nodeIdMapCollection: NodeIdMap.Collection,
        node: TXorNode,
    ) => ReadonlyArray<NodeIdMapIterator.TKeyValuePair>,
    validationSettings: ValidationSettings,
    correlationId: number,
    cancellationToken: ICancellationToken | undefined,
): Promise<ReadonlyArray<Diagnostic>> {
    const numIds: number = nodeIdCollections.reduce<number>(
        (partial: number, set: Set<number>) => partial + set.size,
        0,
    );

    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateDuplicateIdentifiersForKeyValuePair.name,
        correlationId,
        { numIds },
    );

    if (!numIds) {
        return [];
    }

    const result: Diagnostic[] = [];

    // If we need more cancellability, we can move this into the loop and yield every N iterations.
    await PromiseUtils.yieldForCancellation(cancellationToken);

    for (const collection of nodeIdCollections) {
        for (const nodeId of collection) {
            const node: TXorNode = NodeIdMapUtils.assertXor(nodeIdMapCollection, nodeId);
            const duplicateFieldsByKey: Map<string, NodeIdMapIterator.TKeyValuePair[]> = new Map();
            const knownFieldByKey: Map<string, NodeIdMapIterator.TKeyValuePair> = new Map();

            for (const field of iterNodeFactory(nodeIdMapCollection, node)) {
                const keyLiteral: string = field.normalizedKeyLiteral;

                const duplicateFields: NodeIdMapIterator.TKeyValuePair[] | undefined =
                    duplicateFieldsByKey.get(keyLiteral);

                const knownFeld: NodeIdMapIterator.TKeyValuePair | undefined = knownFieldByKey.get(keyLiteral);

                if (duplicateFields) {
                    duplicateFields.push(field);
                } else if (knownFeld) {
                    duplicateFieldsByKey.set(keyLiteral, [field, knownFeld]);
                } else {
                    knownFieldByKey.set(keyLiteral, field);
                }
            }

            for (const duplicates of duplicateFieldsByKey.values()) {
                const numFields: number = duplicates.length;

                const asRelatedInformation: DiagnosticRelatedInformation[] = duplicates.map(
                    (keyValuePair: NodeIdMapIterator.TKeyValuePair) => ({
                        location: {
                            uri: documentUri,
                            range: PositionUtils.rangeFromTokenRange(keyValuePair.key.tokenRange),
                        },
                        message: createDuplicateIdentifierDiagnosticMessage(keyValuePair, validationSettings),
                    }),
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
    }

    trace.exit();

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
        range: PositionUtils.rangeFromTokenRange(keyValuePair.key.tokenRange),
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

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { Diagnostic, DiagnosticRelatedInformation, DocumentUri } from "vscode-languageserver-types";
import { DiagnosticSeverity } from "vscode-languageserver-types";

import * as LanguageServiceUtils from "../languageServiceUtils";

import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { Localization, LocalizationUtils } from "../localization";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { ValidationSettings } from "./validationSettings";
import { Inspection } from "..";

export function validateInvokeExpression<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: Inspection.InspectionSettings<S>,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    maybeCache?: Inspection.TypeCache,
): Diagnostic[] {
    const maybeInvokeExpressionIds: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(
        PQP.Language.Ast.NodeKind.InvokeExpression,
    );
    if (maybeInvokeExpressionIds === undefined) {
        return [];
    }
    // const xorNodes: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.NodeIdMapIterator.assertIterXor(
    //     nodeIdMapCollection,
    //     [...maybeIds.values()],
    // );

    const result: Diagnostic[] = [];
    for (const nodeId of maybeInvokeExpressionIds) {
        const triedInvokeExpression: Inspection.TriedInvokeExpression = Inspection.tryInvokeExpression(
            settings,
            nodeIdMapCollection,
            nodeId,
            maybeCache,
        );
        if (PQP.ResultUtils.isError(triedInvokeExpression)) {
            throw triedInvokeExpression;
        }

        result.push(...invokeExpressionToDiagnostics(triedInvokeExpression.value));
    }

    return result;
}

function invokeExpressionToDiagnostics(invokeExpression: Inspection.InvokeExpression): Diagnostic[] {
    const result: Diagnostic[] = [];

    if (invokeExpression.maybeArguments !== undefined) {
        const invokeExpressionArguments: Inspection.InvokeExpressionArguments = invokeExpression.maybeArguments;
        const numGivenArguments: number = invokeExpressionArguments.givenArguments.length;

        if (numGivenArguments < invokeExpressionArguments.numMaxExpectedArguments) {
            result.push();
        }
    }
}

function createTooFewArgumentMessage(settings: Inspection.InspectionSettings): string {}

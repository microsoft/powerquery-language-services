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

        for (const mismatch of invokeExpressionArguments.typeCheck.invalid) {
            result.push(createDiagnosticForMismatch(mismatch));
        }

        const numGivenArguments: number = invokeExpressionArguments.givenArguments.length;

        if (numGivenArguments < invokeExpressionArguments.numMaxExpectedArguments) {
            result.push();
        }
    }
}

function createDiagnosticForMismatch(mismatch: string): Diagnostic {}

function createTooFewArgumentMessage(
    settings: Inspection.InspectionSettings,
    invokeExpression: Inspection.InvokeExpression,
): string {
    return "";
}

function createTooManyArgumentMessage(
    settings: Inspection.InspectionSettings,
    invokeExpression: Inspection.InvokeExpression,
): string {
    return "";
}

function createArgumentTypeMismatchMessage(
    settings: Inspection.InspectionSettings,
    invokeExpression: Inspection.InvokeExpression,
    index: number,
): string {
    const maybeFunctionName: string | undefined = invokeExpression.maybeName;
    const invokeExpressionArguments: Inspection.InvokeExpressionArguments = PQP.Assert.asDefined(
        invokeExpression.maybeArguments,
    );
    const givenArgument: PQP.Parser.TXorNode = PQP.Assert.asDefined(invokeExpressionArguments.givenArguments[index]);
    const givenArgumentType: PQP.Language.Type.PowerQueryType = PQP.Assert.asDefined(
        invokeExpressionArguments.givenArgumentTypes[index],
    );
    const expectedArgumentType: PQP.Language.Type.PowerQueryType = invokeExpressionArguments.typeCheck.invalid.find(
        mismatch => mismatch.key,
    );

    // const givenArgumentName: string = invokeExpression.maybeArguments;

    return "";
}

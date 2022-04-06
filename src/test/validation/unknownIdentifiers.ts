// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import * as PQLS from "../../powerquery-language-services";
import {
    Diagnostic,
    DiagnosticErrorCode,
    Position,
    TextDocument,
    ValidationSettings,
} from "../../powerquery-language-services";
import { SimpleValidationSettings } from "../testConstants";
import { TestUtils } from "..";
import { ValidationResult } from "../../powerquery-language-services/validate/validationResult";

interface AbridgedUnknownIdentifierDiagnostic {
    readonly message: string;
    readonly startPosition: Position;
}

const ExpectedNamePattern: RegExp = /Unknown name '[^']+'/;

async function expectGetInvokeExpressionDiagnostics(
    textDocument: TextDocument,
): Promise<ReadonlyArray<AbridgedUnknownIdentifierDiagnostic>> {
    const validationResult: ValidationResult = await TestUtils.assertGetValidationResult(textDocument);
    const diagnostics: Diagnostic[] = validationResult.diagnostics;

    return diagnostics
        .filter((diagnostic: Diagnostic) => diagnostic.code === DiagnosticErrorCode.UnknownIdentifier)
        .map((diagnostic: Diagnostic) => ({
            message: diagnostic.message,
            startPosition: Assert.asDefined(diagnostic.range).start,
        }));
}

function expectUnknownIdentifiers(
    abridgedDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic>,
    unknownIdentifiers: ReadonlyArray<string>,
): void {
    const unknowns: Set<string> = new Set(unknownIdentifiers);

    for (const abridgedDiagnostic of abridgedDiagnostics) {
        const diagnosticLiteral: string = Assert.asDefined(ExpectedNamePattern.exec(abridgedDiagnostic.message))[1];

        if (!unknowns.has(diagnosticLiteral)) {
            throw new Error(`Found an unknown identifier that wasn't expected: '${diagnosticLiteral}'`);
        } else {
            unknowns.delete(diagnosticLiteral);
        }
    }

    if (unknowns.size !== 0) {
        throw new Error(`at least one expected unknown identifier wasn't found: ${[...unknowns.values()]}`);
    }
}

describe("Validation - UnknownIdentifier", () => {
    describe(`checkUnknownIdentifiers = false`, () => {
        const validationSettings: ValidationSettings = {
            ...SimpleValidationSettings,
            checkUnknownIdentifiers: false,
        };

        it(`suppressed`, async () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(`let x = 1 in y`);

            const validationResult: ValidationResult = await PQLS.validate(textDocument, validationSettings);
            expect(validationResult.diagnostics.length).to.equal(0);
        });
    });

    describe(`simple`, () => {
        it(`expects [1, 1] arguments, 0 given`, async () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(`let foo = 1 in bar`);

            const invocationDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
                await expectGetInvokeExpressionDiagnostics(textDocument);

            expectUnknownIdentifiers(invocationDiagnostics, ["bar"]);
        });
    });
});

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";

import {
    Diagnostic,
    DiagnosticErrorCode,
    Position,
    TextDocument,
    ValidationSettings,
} from "../../powerquery-language-services";
import { expectLessWhenSurpressed } from "./common";
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
        it(`argument count suppressed`, async () => {
            const text: string = `let foo = 1 in bar`;

            const withInvokeCheckSettings: ValidationSettings = {
                ...SimpleValidationSettings,
                checkUnknownIdentifiers: true,
            };

            const withoutInvokeCheckSettings: ValidationSettings = {
                ...SimpleValidationSettings,
                checkUnknownIdentifiers: false,
            };

            await expectLessWhenSurpressed(text, withInvokeCheckSettings, withoutInvokeCheckSettings);
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

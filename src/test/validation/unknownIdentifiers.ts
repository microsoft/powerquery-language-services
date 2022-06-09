// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, MapUtils } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import {
    Diagnostic,
    DiagnosticErrorCode,
    Position,
    TextDocument,
    ValidationSettings,
} from "../../powerquery-language-services";
import { SimpleValidateNoneSettings, TestLibraryName } from "../testConstants";
import { expectLessWhenSurpressed } from "./common";
import { TestUtils } from "..";
import { ValidationResult } from "../../powerquery-language-services/validate/validationResult";

interface AbridgedUnknownIdentifierDiagnostic {
    readonly message: string;
    readonly startPosition: Position;
}

const ExpectedNameAndSuggestionPattern: RegExp = /Cannot find the name '([^']+)', did you mean '([^']+)'\?/;

const UnknownIdentifierSettings: ValidationSettings = {
    ...SimpleValidateNoneSettings,
    checkForDuplicateIdentifiers: true,
};

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

function expectNoUnknownIdentifiers(abridgedDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic>): void {
    expect(abridgedDiagnostics.length).equal(0);
}

function expectUnknownIdentifierSuggestions(
    abridgedDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic>,
    unknownIdentifiers: Map<string, string>,
): void {
    const unknowns: Set<string> = new Set(unknownIdentifiers.keys());

    for (const abridgedDiagnostic of abridgedDiagnostics) {
        const regExpExecArray: RegExpExecArray = Assert.asDefined(
            ExpectedNameAndSuggestionPattern.exec(abridgedDiagnostic.message),
        );

        const diagnosticLiteral: string = regExpExecArray[1];
        const diagnosticSuggestion: string = regExpExecArray[2];

        const expectedSuggestion: string = MapUtils.assertGet(unknownIdentifiers, diagnosticLiteral);

        if (!unknowns.has(diagnosticLiteral)) {
            throw new Error(`Found an unknown identifier that wasn't expected: '${diagnosticLiteral}'`);
        } else if (expectedSuggestion !== diagnosticSuggestion) {
            throw new Error(
                `Found an unknown identifier that had an unexpected suggestion: ${JSON.stringify({
                    diagnosticSuggestion,
                    expectedSuggestion,
                })}`,
            );
        }

        unknowns.delete(diagnosticLiteral);
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
                ...UnknownIdentifierSettings,
                checkUnknownIdentifiers: true,
            };

            const withoutInvokeCheckSettings: ValidationSettings = SimpleValidateNoneSettings;

            await expectLessWhenSurpressed(text, withInvokeCheckSettings, withoutInvokeCheckSettings);
        });
    });

    describe(`no suggestion`, () => {
        it(`found in local scope`, async () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(`let foo = 1 in foo`);

            const invocationDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
                await expectGetInvokeExpressionDiagnostics(textDocument);

            expectNoUnknownIdentifiers(invocationDiagnostics);
        });

        it(`found recursive in local scope`, async () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(
                `let fib = (x as number) => if x = 0 or x = 1 then 1 else @fib(x - 1) + @fib(x - 2)`,
            );

            const invocationDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
                await expectGetInvokeExpressionDiagnostics(textDocument);

            expectNoUnknownIdentifiers(invocationDiagnostics);
        });

        it(`found in library scope`, async () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(
                `${TestLibraryName.CreateFooAndBarRecord}`,
            );

            const invocationDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
                await expectGetInvokeExpressionDiagnostics(textDocument);

            expectNoUnknownIdentifiers(invocationDiagnostics);
        });
    });

    describe(`suggestion`, () => {
        it(`local scope`, async () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(`let foo = 1 in fo`);

            const invocationDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
                await expectGetInvokeExpressionDiagnostics(textDocument);

            expectUnknownIdentifierSuggestions(invocationDiagnostics, new Map<string, string>([["fo", "foo"]]));
        });

        it(`library`, async () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(`test.n`);

            const invocationDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
                await expectGetInvokeExpressionDiagnostics(textDocument);

            expectUnknownIdentifierSuggestions(
                invocationDiagnostics,
                new Map<string, string>([["test.n", "Test.Number"]]),
            );
        });
    });

    it(`allow redundant recursive identifier`, async () => {
        const textDocument: TextDocument = TestUtils.createTextMockDocument(`let foo = 1 in @foo`);

        const invocationDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
            await expectGetInvokeExpressionDiagnostics(textDocument);

        expectNoUnknownIdentifiers(invocationDiagnostics);
    });
});

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, MapUtils } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import { Diagnostic, DiagnosticErrorCode, Position, ValidationSettings } from "../../powerquery-language-services";
import { SimpleValidateNoneSettings, TestLibraryName } from "../testConstants";
import { TestConstants, TestUtils } from "..";
import { assertLessWhenSurpressed } from "../testUtils/validationTestUtils";

interface AbridgedUnknownIdentifierDiagnostic {
    readonly message: string;
    readonly startPosition: Position;
}

const ExpectedNameAndSuggestionPattern: RegExp = /Cannot find the name '([^']+)', did you mean '([^']+)'\?/;

const UnknownIdentifierSettings: ValidationSettings = {
    ...SimpleValidateNoneSettings,
    checkForDuplicateIdentifiers: true,
    checkDiagnosticsOnParseError: true,
};

async function assertUnknownIdentifierDiagnostics(
    text: string,
): Promise<ReadonlyArray<AbridgedUnknownIdentifierDiagnostic>> {
    const diagnostics: Diagnostic[] = await TestUtils.assertValidateDiagnostics({
        text,
        analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
        validationSettings: TestConstants.SimpleLibraryValidateAllSettings,
    });

    return diagnostics
        .filter((diagnostic: Diagnostic) => diagnostic.code === DiagnosticErrorCode.UnknownIdentifier)
        .map((diagnostic: Diagnostic) => ({
            message: diagnostic.message,
            startPosition: Assert.asDefined(diagnostic.range).start,
        }));
}

async function assertNoUnknownIdentifiers(text: string): Promise<void> {
    const abridgedDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
        await assertUnknownIdentifierDiagnostics(text);

    expect(abridgedDiagnostics.length).equal(0);
}

async function assertUnknownIdentifierSuggestions(
    text: string,
    unknownIdentifiers: Map<string, string>,
): Promise<void> {
    const abridgedDiagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
        await assertUnknownIdentifierDiagnostics(text);

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

            const withCheckSettings: ValidationSettings = {
                ...UnknownIdentifierSettings,
                checkUnknownIdentifiers: true,
            };

            const withoutCheckSettings: ValidationSettings = SimpleValidateNoneSettings;

            await assertLessWhenSurpressed({
                text,
                withCheckSettings,
                withoutCheckSettings,
            });
        });
    });

    describe(`no suggestion`, () => {
        it(`found in local scope`, async () => await assertNoUnknownIdentifiers(`let foo = 1 in foo`));

        xit(`FIXME found recursive in local scope`, async () =>
            await assertNoUnknownIdentifiers(
                `let fib = (x as number) => if x = 0 or x = 1 then 1 else @fib(x - 1) + @fib(x - 2)`,
            ));

        describe(`found in library scope`, () => {
            it(`regular identifier`, async () =>
                await assertNoUnknownIdentifiers(`${TestLibraryName.CreateFooAndBarRecord}`));

            it(`quoted regular identifier`, async () =>
                await assertNoUnknownIdentifiers(`#"${TestLibraryName.CreateFooAndBarRecord}"`));

            it(`recursive identifier`, async () =>
                await assertNoUnknownIdentifiers(`@${TestLibraryName.CreateFooAndBarRecord}`));

            it(`recursive and quoted regular identifier`, async () =>
                await assertNoUnknownIdentifiers(`@#"${TestLibraryName.CreateFooAndBarRecord}"`));
        });
    });

    describe(`suggestion`, () => {
        it(`local scope`, async () =>
            await assertUnknownIdentifierSuggestions(`let foo = 1 in fo`, new Map([["fo", "foo"]])));

        it(`library`, async () =>
            await assertUnknownIdentifierSuggestions(`test.n`, new Map([["test.n", "Test.Number"]])));
    });

    it(`allow redundant recursive identifier`, async () => await assertNoUnknownIdentifiers(`let foo = 1 in @foo`));
});

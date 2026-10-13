// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as JaroWinkler from "../../powerquery-language-services/jaroWinkler";
import { Assert, MapUtils } from "@microsoft/powerquery-parser";
import { Mock, mock } from "node:test";
import { expect } from "chai";

import {
    Diagnostic,
    DiagnosticErrorCode,
    Library,
    Position,
    ValidationSettings,
} from "../../powerquery-language-services";
import { SimpleValidateNoneSettings, TestLibraryName } from "../testConstants";
import { TestConstants, TestUtils } from "..";
import { assertLessWhenSuppressed } from "../testUtils/validationTestUtils";

interface AbridgedUnknownIdentifierDiagnostic {
    readonly message: string;
    readonly startPosition: Position;
}

const ExpectedNameAndSuggestionPattern: RegExp = /Cannot find the name '([^']+)', did you mean '([^']+)'\?/;

const UnknownIdentifierSettings: ValidationSettings = {
    ...SimpleValidateNoneSettings,
    checkForDuplicateIdentifiers: true,
};

async function assertUnknownIdentifierDiagnostics(
    text: string,
    library: Library.ILibrary = TestConstants.SimpleLibrary,
): Promise<ReadonlyArray<AbridgedUnknownIdentifierDiagnostic>> {
    const diagnostics: Diagnostic[] = await TestUtils.assertValidateDiagnostics({
        text,
        analysisSettings: {
            ...TestConstants.SimpleLibraryAnalysisSettings,
            inspectionSettings: {
                ...TestConstants.SimpleLibraryAnalysisSettings.inspectionSettings,
                library,
            },
        },
        validationSettings: { ...TestConstants.SimpleLibraryValidateAllSettings, library },
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
    it("preserves diagnostic source order across sequential scope inspections", async () => {
        const diagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
            await assertUnknownIdentifierDiagnostics(
                "let\n    first = missingFirst,\n    second = missingSecond\nin\n    missingThird",
            );

        expect(diagnostics).to.deep.equal([
            { message: "Cannot find the name 'missingFirst'.", startPosition: Position.create(1, 12) },
            { message: "Cannot find the name 'missingSecond'.", startPosition: Position.create(2, 13) },
            { message: "Cannot find the name 'missingThird'.", startPosition: Position.create(4, 4) },
        ]);
    });

    describe(`checkUnknownIdentifiers = false`, () => {
        it(`argument count suppressed`, async () => {
            const text: string = `let foo = 1 in bar`;

            const withCheckSettings: ValidationSettings = {
                ...UnknownIdentifierSettings,
                checkUnknownIdentifiers: true,
            };

            const withoutCheckSettings: ValidationSettings = SimpleValidateNoneSettings;

            await assertLessWhenSuppressed({
                text,
                withCheckSettings,
                withoutCheckSettings,
            });
        });
    });

    describe(`no suggestion`, () => {
        it(`found in local scope`, async () => await assertNoUnknownIdentifiers(`let foo = 1 in foo`));

        it(`found recursive in local scope`, async () =>
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

        it(`preserves local spelling for repeated normalized pairs in different scopes`, async () =>
            await assertUnknownIdentifierSuggestions(
                `{let Table.AddColumn = 1 in tabl.addcolumn, let TABLE.ADDCOLUMN = 2 in TABL.ADDCOLUMN}`,
                new Map([
                    ["tabl.addcolumn", "Table.AddColumn"],
                    ["TABL.ADDCOLUMN", "TABLE.ADDCOLUMN"],
                ]),
            ));

        it("prefers the local spelling when a pruning bound rounds below an equal library score", async () => {
            const library: Library.ILibrary = {
                ...TestConstants.EmptyLibrary,
                libraryDefinitions: {
                    ...TestConstants.EmptyLibrary.libraryDefinitions,
                    staticLibraryDefinitions: new Map([
                        [
                            "aaaaaaaaaaaa",
                            MapUtils.assertGet(
                                TestConstants.SimpleLibrary.libraryDefinitions.staticLibraryDefinitions,
                                TestLibraryName.Number,
                            ),
                        ],
                    ]),
                },
            };

            const diagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
                await assertUnknownIdentifierDiagnostics("let AAAAAAAAAAAA = 1 in aaaaa", library);

            expect(
                diagnostics.map((diagnostic: AbridgedUnknownIdentifierDiagnostic) => diagnostic.message),
            ).to.deep.equal(["Cannot find the name 'aaaaa', did you mean 'AAAAAAAAAAAA'?"]);
        });
    });

    describe("lazy library preparation", () => {
        for (const [text, expectedPreparations, expectedDiagnostics] of [
            ["1", 0, 0],
            ["let a = 1 in a", 0, 0],
            [TestLibraryName.Number, 0, 0],
            ["let apple = 1 in {appl, appl, applee}", 1, 3],
        ] as const) {
            it(text, async () => {
                const preparation: Mock<typeof JaroWinkler.prepareJaroWinklerOptions> = mock.method(
                    JaroWinkler,
                    "prepareJaroWinklerOptions",
                );

                try {
                    const diagnostics: ReadonlyArray<AbridgedUnknownIdentifierDiagnostic> =
                        await assertUnknownIdentifierDiagnostics(text);

                    expect(diagnostics.length).to.equal(expectedDiagnostics);
                    expect(preparation.mock.callCount()).to.equal(expectedPreparations);
                } finally {
                    preparation.mock.restore();
                }
            });
        }
    });

    describe("empty library", () => {
        for (const [text, message] of [
            [`let apple = 1 in appl`, `Cannot find the name 'appl', did you mean 'apple'?`],
            [`let apple = 1 in zzzzzz`, `Cannot find the name 'zzzzzz'.`],
            [`missing`, `Cannot find the name 'missing'.`],
        ]) {
            it(text, async () => {
                const diagnostics: Diagnostic[] = await TestUtils.assertValidateDiagnostics({
                    text,
                    analysisSettings: {
                        ...TestConstants.SimpleLibraryAnalysisSettings,
                        inspectionSettings: {
                            ...TestConstants.SimpleLibraryAnalysisSettings.inspectionSettings,
                            library: TestConstants.EmptyLibrary,
                        },
                    },
                    validationSettings: {
                        ...TestConstants.SimpleLibraryValidateAllSettings,
                        library: TestConstants.EmptyLibrary,
                    },
                });

                expect(
                    diagnostics.map((diagnostic: Diagnostic) => [diagnostic.code, diagnostic.message]),
                ).to.deep.equal([[DiagnosticErrorCode.UnknownIdentifier, message]]);
            });
        }
    });

    it(`allow redundant recursive identifier`, async () => await assertNoUnknownIdentifiers(`let foo = 1 in @foo`));
});

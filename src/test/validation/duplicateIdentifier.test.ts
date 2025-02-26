// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { assert, expect } from "chai";
import { Assert } from "@microsoft/powerquery-parser";

import {
    Diagnostic,
    DiagnosticErrorCode,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Position,
    ValidationSettings,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { ValidateOk } from "../../powerquery-language-services/validate/validateOk";

function assertValidationError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.code);
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

async function expectNoValidationErrors(text: string): Promise<void> {
    const validationResult: ValidateOk = await TestUtils.assertValidate(
        TestConstants.SimpleLibraryAnalysisSettings,
        DuplicateIdentifierSettings,
        text,
    );

    expect(validationResult.hasSyntaxError).to.equal(false, "hasSyntaxError flag should be false");
    expect(validationResult.diagnostics.length).to.equal(0, "no diagnostics expected");
}

interface DuplicateIdentifierError {
    readonly name: string;
    readonly position: Position;
    readonly relatedPositions: ReadonlyArray<Position>;
}

const DuplicateIdentifierSettings: ValidationSettings = {
    ...TestConstants.SimpleValidateNoneSettings,
    checkForDuplicateIdentifiers: true,
};

async function validateDuplicateIdentifierDiagnostics(
    text: string,
    expected: ReadonlyArray<DuplicateIdentifierError>,
): Promise<void> {
    const validationResult: ValidateOk = await TestUtils.assertValidate(
        TestConstants.SimpleLibraryAnalysisSettings,
        DuplicateIdentifierSettings,
        text,
    );

    const errorSource: string = DuplicateIdentifierSettings.source;
    const diagnostics: ReadonlyArray<Diagnostic> = validationResult.diagnostics;

    const actual: ReadonlyArray<Diagnostic> = diagnostics.filter(
        (diagnostic: Diagnostic) => diagnostic.code === DiagnosticErrorCode.DuplicateIdentifier,
    );

    const abridgedActual: DuplicateIdentifierError[] = [];

    for (const diagnostic of actual) {
        Assert.isDefined(diagnostic.relatedInformation);
        expect(diagnostic.relatedInformation?.length).to.be.greaterThan(0, "expected at least one relatedInformation");
        expect(diagnostic.source).to.equal(errorSource, `expected diagnostic to have errorSource of ${errorSource}`);

        const match: RegExpMatchArray | null = diagnostic.message.match(/'(.*?)'/);
        const name: string = match ? match[1] : "";

        abridgedActual.push({
            name,
            position: diagnostic.range.start,
            relatedPositions: diagnostic.relatedInformation.map(
                (related: DiagnosticRelatedInformation) => related.location.range.start,
            ),
        });
    }

    expect(abridgedActual).deep.equals(expected);
}

describe(`Validation - duplicateIdentifier`, () => {
    describe("Syntax validation", () => {
        it("no errors", async () => await expectNoValidationErrors(`let b = 1 in b`));

        it("let 1", async () => {
            const errorSource: string = DuplicateIdentifierSettings.source;

            const validationResult: ValidateOk = await TestUtils.assertValidate(
                TestConstants.SimpleLibraryAnalysisSettings,
                DuplicateIdentifierSettings,
                `let 1`,
            );

            expect(validationResult.hasSyntaxError).to.equal(true, "hasSyntaxError flag should be true");
            expect(validationResult.diagnostics.length).to.equal(1);
            expect(validationResult.diagnostics[0].source).to.equal(errorSource);
            assertValidationError(validationResult.diagnostics[0], { line: 0, character: 4 });
        });

        it("HelloWorldWithDocs.pq", async () => {
            await expectNoValidationErrors(TestUtils.readFile("HelloWorldWithDocs.pq"));
        });

        it("DirectQueryForSQL.pq", async () => {
            await expectNoValidationErrors(TestUtils.readFile("DirectQueryForSQL.pq"));
        });
    });

    describe("Duplicate identifiers", () => {
        it("let a = 1, a = 2 in a", async () =>
            await validateDuplicateIdentifierDiagnostics(`let a = 1, a = 2 in a`, [
                {
                    name: "a",
                    position: { line: 0, character: 11 },
                    relatedPositions: [{ line: 0, character: 4 }],
                },
                {
                    name: "a",
                    position: { line: 0, character: 4 },
                    relatedPositions: [{ line: 0, character: 11 }],
                },
            ]));

        it("let rec = [ a = 1, b = 2, c = 3, a = 4] in rec", async () =>
            await validateDuplicateIdentifierDiagnostics(`let rec = [ a = 1, b = 2, c = 3, a = 4] in rec`, [
                {
                    name: "a",
                    position: { line: 0, character: 33 },
                    relatedPositions: [{ line: 0, character: 12 }],
                },
                {
                    name: "a",
                    position: { line: 0, character: 12 },
                    relatedPositions: [{ line: 0, character: 33 }],
                },
            ]));

        it("[a = 1, b = 2, c = 3, a = 4]", async () =>
            await validateDuplicateIdentifierDiagnostics(`[a = 1, b = 2, c = 3, a = 4]`, [
                {
                    name: "a",
                    position: { line: 0, character: 22 },
                    relatedPositions: [{ line: 0, character: 1 }],
                },
                {
                    name: "a",
                    position: { line: 0, character: 1 },
                    relatedPositions: [{ line: 0, character: 22 }],
                },
            ]));

        it(`[#"a" = 1, a = 2, b = 3]`, async () =>
            await validateDuplicateIdentifierDiagnostics(`[#"a" = 1, a = 2, b = 3]`, [
                {
                    name: "a",
                    position: { line: 0, character: 11 },
                    relatedPositions: [{ line: 0, character: 1 }],
                },
                {
                    name: `#"a"`,
                    position: { line: 0, character: 1 },
                    relatedPositions: [{ line: 0, character: 11 }],
                },
            ]));

        it("type [a = number, b = number, a = logical]", async () => {
            await validateDuplicateIdentifierDiagnostics(`type [a = number, b = number, a = logical]`, [
                {
                    name: "a",
                    position: { character: 30, line: 0 },
                    relatedPositions: [{ character: 6, line: 0 }],
                },
                {
                    name: "a",
                    position: { character: 6, line: 0 },
                    relatedPositions: [{ character: 30, line: 0 }],
                },
            ]);
        });

        it('section foo; shared a = 1; a = "hello";', async () =>
            await validateDuplicateIdentifierDiagnostics('section foo; shared a = 1; a = "hello";', [
                {
                    name: "a",
                    position: { line: 0, character: 27 },
                    relatedPositions: [{ line: 0, character: 20 }],
                },
                {
                    name: "a",
                    position: { line: 0, character: 20 },
                    relatedPositions: [{ line: 0, character: 27 }],
                },
            ]));

        it("section foo; shared a = let a = 1 in a; b = let b = 1, b = 2 in b;", async () =>
            await validateDuplicateIdentifierDiagnostics(
                `section foo; shared a = let a = 1 in a; b = let b = 1, b = 2, b = 3 in b;`,
                [
                    {
                        name: "b",
                        position: { character: 55, line: 0 },
                        relatedPositions: [
                            { character: 48, line: 0 },
                            { character: 62, line: 0 },
                        ],
                    },
                    {
                        name: "b",
                        position: { character: 48, line: 0 },
                        relatedPositions: [
                            { character: 55, line: 0 },
                            { character: 62, line: 0 },
                        ],
                    },
                    {
                        name: "b",
                        position: { character: 62, line: 0 },
                        relatedPositions: [
                            { character: 55, line: 0 },
                            { character: 48, line: 0 },
                        ],
                    },
                ],
            ));

        it("let a = 1 meta [ abc = 1, abc = 3 ] in a", async () =>
            await validateDuplicateIdentifierDiagnostics(`let a = 1 meta [ abc = 1, abc = 3 ] in a`, [
                {
                    name: "abc",
                    position: { line: 0, character: 26 },
                    relatedPositions: [{ line: 0, character: 17 }],
                },
                {
                    name: "abc",
                    position: { line: 0, character: 17 },
                    relatedPositions: [{ line: 0, character: 26 }],
                },
            ]));

        it("let a = let abc = 1, abc = 2, b = 3 in b in a", async () =>
            await validateDuplicateIdentifierDiagnostics(`let a = let abc = 1, abc = 2, b = 3 in b in a`, [
                {
                    name: "abc",
                    position: { line: 0, character: 21 },
                    relatedPositions: [{ line: 0, character: 12 }],
                },
                {
                    name: "abc",
                    position: { line: 0, character: 12 },
                    relatedPositions: [{ line: 0, character: 21 }],
                },
            ]));

        it('section foo; a = let #"s p a c e" = 2, #"s p a c e" = 3, a = 2 in a;', async () =>
            await validateDuplicateIdentifierDiagnostics(
                `section foo; a = let #"s p a c e" = 2, #"s p a c e" = 3, a = 2 in a;`,
                [
                    {
                        name: '#"s p a c e"',
                        position: { line: 0, character: 39 },
                        relatedPositions: [{ line: 0, character: 21 }],
                    },
                    {
                        name: '#"s p a c e"',
                        position: { line: 0, character: 21 },
                        relatedPositions: [{ line: 0, character: 39 }],
                    },
                ],
            ));
    });
});

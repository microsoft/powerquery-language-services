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
    documentUpdated,
    Position,
    TextDocumentContentChangeEvent,
    validate,
    ValidationSettings,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { MockDocument } from "../mockDocument";
import { ValidationResult } from "../../powerquery-language-services/validate/validationResult";

function assertValidationError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.code);
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

async function expectNoValidationErrors(textDocument: MockDocument): Promise<void> {
    const validationResult: ValidationResult = await validate(
        textDocument,
        TestConstants.SimpleLibraryAnalysisSettings,
        DuplicateIdentifierSettings,
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
    textDocument: MockDocument,
    expected: ReadonlyArray<DuplicateIdentifierError>,
): Promise<void> {
    const validationResult: ValidationResult = await validate(
        textDocument,
        TestConstants.SimpleLibraryAnalysisSettings,
        DuplicateIdentifierSettings,
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
        it("no errors", async () => {
            await expectNoValidationErrors(TestUtils.createTextMockDocument("let b = 1 in b"));
        });

        it("let 1", async () => {
            const errorSource: string = DuplicateIdentifierSettings.source;

            const validationResult: ValidationResult = await validate(
                TestUtils.createTextMockDocument(`let 1`),
                TestConstants.SimpleLibraryAnalysisSettings,
                DuplicateIdentifierSettings,
            );

            expect(validationResult.hasSyntaxError).to.equal(true, "hasSyntaxError flag should be true");
            expect(validationResult.diagnostics.length).to.equal(1);
            expect(validationResult.diagnostics[0].source).to.equal(errorSource);
            assertValidationError(validationResult.diagnostics[0], { line: 0, character: 4 });
        });

        it("HelloWorldWithDocs.pq", async () => {
            await expectNoValidationErrors(TestUtils.createFileMockDocument("HelloWorldWithDocs.pq"));
        });

        it("DirectQueryForSQL.pq", async () => {
            await expectNoValidationErrors(TestUtils.createFileMockDocument("DirectQueryForSQL.pq"));
        });
    });

    describe("validation with workspace cache", () => {
        it("no errors after update", async () => {
            const text: string = "let a = 1,";
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            const diagnostics: ReadonlyArray<Diagnostic> = (
                await validate(textDocument, TestConstants.SimpleLibraryAnalysisSettings, DuplicateIdentifierSettings)
            ).diagnostics;

            expect(diagnostics.length).to.be.greaterThan(0, "validation result is expected to have errors");

            const changes: ReadonlyArray<TextDocumentContentChangeEvent> = textDocument.update("1");
            documentUpdated(textDocument, changes, textDocument.version);

            await expectNoValidationErrors(textDocument);
        });

        it("errors after update", async () => {
            const text: string = "let a = 1 in a";
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);
            await expectNoValidationErrors(textDocument);

            const changes: ReadonlyArray<TextDocumentContentChangeEvent> = textDocument.update(";;;;;;");
            documentUpdated(textDocument, changes, textDocument.version);

            const diagnostics: ReadonlyArray<Diagnostic> = (
                await validate(textDocument, TestConstants.SimpleLibraryAnalysisSettings, DuplicateIdentifierSettings)
            ).diagnostics;

            expect(diagnostics.length).to.be.greaterThan(0, "validation result is expected to have errors");
        });
    });

    describe("Duplicate identifiers", () => {
        it("let a = 1, a = 2 in a", async () => {
            const text: string = "let a = 1, a = 2 in a";
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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
            ]);
        });

        it("let rec = [ a = 1, b = 2, c = 3, a = 4] in rec", async () => {
            const text: string = "let rec = [ a = 1, b = 2, c = 3, a = 4] in rec";
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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
            ]);
        });

        it("[a = 1, b = 2, c = 3, a = 4]", async () => {
            const text: string = "[a = 1, b = 2, c = 3, a = 4]";
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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
            ]);
        });

        it(`[#"a" = 1, a = 2, b = 3]`, async () => {
            const text: string = `[#"a" = 1, a = 2, b = 3]`;
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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
            ]);
        });

        it("type [a = number, b = number, a = logical]", async () => {
            const text: string = "type [a = number, b = number, a = logical]";
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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

        it('section foo; shared a = 1; a = "hello";', async () => {
            const text: string = 'section foo; shared a = 1; a = "hello";';
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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
            ]);
        });

        it("section foo; shared a = let a = 1 in a; b = let b = 1, b = 2 in b;", async () => {
            const text: string = "section foo; shared a = let a = 1 in a; b = let b = 1, b = 2, b = 3 in b;";
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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
            ]);
        });

        it("let a = 1 meta [ abc = 1, abc = 3 ] in a", async () => {
            const text: string = "let a = 1 meta [ abc = 1, abc = 3 ] in a";
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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
            ]);
        });

        it("let a = let abc = 1, abc = 2, b = 3 in b in a", async () => {
            const text: string = "let a = let abc = 1, abc = 2, b = 3 in b in a";
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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
            ]);
        });

        it('section foo; a = let #"s p a c e" = 2, #"s p a c e" = 3, a = 2 in a;', async () => {
            const text: string = 'section foo; a = let #"s p a c e" = 2, #"s p a c e" = 3, a = 2 in a;';
            const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

            await validateDuplicateIdentifierDiagnostics(textDocument, [
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
            ]);
        });
    });
});

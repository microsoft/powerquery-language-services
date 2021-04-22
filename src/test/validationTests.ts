// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import { Assert } from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";

import { TestUtils } from ".";
import {
    Diagnostic,
    DiagnosticErrorCode,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    documentUpdated,
    Position,
    TextDocument,
    TextDocumentContentChangeEvent,
    validate,
    ValidationOptions,
    ValidationResult,
} from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";

const DefaultValidationOptions: ValidationOptions = {
    maintainWorkspaceCache: true,
};

function assertValidationError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.code);
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

function expectNoValidationErrors(document: TextDocument): void {
    const validationResult: ValidationResult = validate(document, DefaultValidationOptions);
    expect(validationResult.isSyntaxError).to.equal(false, "syntaxError flag should be false");
    expect(validationResult.diagnostics.length).to.equal(0, "no diagnostics expected");
}

interface DuplicateIdentifierError {
    readonly name: string;
    readonly position: Position;
    readonly relatedPositions: ReadonlyArray<Position>;
}

function validateDuplicateIdentifierDiagnostics(
    document: TextDocument,
    expected: ReadonlyArray<DuplicateIdentifierError>,
): void {
    const errorSource: string = "UNIT-TESTS";
    const validationResult: ValidationResult = validate(document, {
        maintainWorkspaceCache: false,
        checkForDuplicateIdentifiers: true,
        source: errorSource,
    });
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

describe("Syntax validation", () => {
    it("no errors", () => {
        expectNoValidationErrors(TestUtils.createTextMockDocument("let b = 1 in b"));
    });

    it("let 1", () => {
        const document: TextDocument = TestUtils.createTextMockDocument("let 1");
        const errorSource: string = "powerquery";
        const validationResult: ValidationResult = validate(document, {
            source: errorSource,
            maintainWorkspaceCache: false,
        });
        expect(validationResult.isSyntaxError).to.equal(true, "syntaxError flag should be true");
        expect(validationResult.diagnostics.length).to.equal(1);
        expect(validationResult.diagnostics[0].source).to.equal(errorSource);
        assertValidationError(validationResult.diagnostics[0], { line: 0, character: 4 });
    });

    it("HelloWorldWithDocs.pq", () => {
        expectNoValidationErrors(TestUtils.createFileMockDocument("HelloWorldWithDocs.pq"));
    });

    it("DirectQueryForSQL.pq", () => {
        expectNoValidationErrors(TestUtils.createFileMockDocument("DirectQueryForSQL.pq"));
    });
});

describe("validation with workspace cache", () => {
    it("no errors after update", () => {
        const document: MockDocument = TestUtils.createTextMockDocument("let a = 1,");
        const diagnostics: ReadonlyArray<Diagnostic> = validate(document, DefaultValidationOptions).diagnostics;
        expect(diagnostics.length).to.be.greaterThan(0, "validation result is expected to have errors");

        const changes: ReadonlyArray<TextDocumentContentChangeEvent> = document.update("1");
        documentUpdated(document, changes, document.version);

        expectNoValidationErrors(document);
    });

    it("errors after update", () => {
        const document: MockDocument = TestUtils.createTextMockDocument("let a = 1 in a");
        expectNoValidationErrors(document);

        const changes: ReadonlyArray<TextDocumentContentChangeEvent> = document.update(";;;;;;");
        documentUpdated(document, changes, document.version);

        const diagnostics: ReadonlyArray<Diagnostic> = validate(document, DefaultValidationOptions).diagnostics;
        expect(diagnostics.length).to.be.greaterThan(0, "validation result is expected to have errors");
    });
});

describe("Duplicate identifiers", () => {
    it("let a = 1, a = 2 in a", () => {
        const document: MockDocument = TestUtils.createTextMockDocument("let a = 1, a = 2 in a");
        validateDuplicateIdentifierDiagnostics(document, [
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

    it("let rec = [ a = 1, b = 2, c = 3, a = 4] in rec", () => {
        const document: MockDocument = TestUtils.createTextMockDocument(
            "let rec = [ a = 1, b = 2, c = 3, a = 4] in rec",
        );
        validateDuplicateIdentifierDiagnostics(document, [
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

    it("[a = 1, b = 2, c = 3, a = 4]", () => {
        const document: MockDocument = TestUtils.createTextMockDocument("[a = 1, b = 2, c = 3, a = 4]");
        validateDuplicateIdentifierDiagnostics(document, [
            {
                name: "a",
                position: { line: 0, character: 23 },
                relatedPositions: [{ line: 0, character: 2 }],
            },
            {
                name: "a",
                position: { line: 0, character: 2 },
                relatedPositions: [{ line: 0, character: 23 }],
            },
        ]);
    });

    it(`[#"a" = 1, a = 2, b = 3]`, () => {
        const document: MockDocument = TestUtils.createTextMockDocument(`[#"a" = 1, a = 2, b = 3]`);
        validateDuplicateIdentifierDiagnostics(document, [
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

    it('section foo; shared a = 1; a = "hello";', () => {
        const document: MockDocument = TestUtils.createTextMockDocument('section foo; shared a = 1; a = "hello";');
        validateDuplicateIdentifierDiagnostics(document, [
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

    it("section foo; shared a = let a = 1 in a; b = let b = 1, b = 2 in b;", () => {
        const document: MockDocument = TestUtils.createTextMockDocument(
            "section foo; shared a = let a = 1 in a; b = let b = 1, b = 2, b = 3 in b;",
        );
        validateDuplicateIdentifierDiagnostics(document, [
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

    it("let a = 1 meta [ abc = 1, abc = 3 ] in a", () => {
        const document: MockDocument = TestUtils.createTextMockDocument("let a = 1 meta [ abc = 1, abc = 3 ] in a");
        validateDuplicateIdentifierDiagnostics(document, [
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

    it("let a = let abc = 1, abc = 2, b = 3 in b in a", () => {
        const document: MockDocument = TestUtils.createTextMockDocument(
            "let a = let abc = 1, abc = 2, b = 3 in b in a",
        );
        validateDuplicateIdentifierDiagnostics(document, [
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

    it('section foo; a = let #"s p a c e" = 2, #"s p a c e" = 3, a = 2 in a;', () => {
        const document: MockDocument = TestUtils.createTextMockDocument(
            'section foo; a = let #"s p a c e" = 2, #"s p a c e" = 3, a = 2 in a;',
        );
        validateDuplicateIdentifierDiagnostics(document, [
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

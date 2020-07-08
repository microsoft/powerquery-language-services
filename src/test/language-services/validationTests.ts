// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { assert, expect } from "chai";
import "mocha";
import {
    Diagnostic,
    DiagnosticErrorCode,
    Position,
    TextDocument,
    TextDocumentContentChangeEvent,
    ValidationOptions,
    ValidationResult,
} from "../../language-services";

import { documentUpdated, validate } from "../../language-services";
import * as Utils from "./utils";

describe("Syntax validation", () => {
    it("no errors", () => {
        expectNoValidationErrors(Utils.documentFromText("let b = 1 in b"));
    });

    it("let 1", () => {
        const document: TextDocument = Utils.documentFromText("let 1");
        const errorSource: string = "powerquery";
        const validationResult: ValidationResult = validate(document, {
            source: errorSource,
            maintainWorkspaceCache: false,
        });
        expect(validationResult.syntaxError).to.equal(true, "syntaxError flag should be true");
        expect(validationResult.diagnostics.length).to.equal(1);
        expect(validationResult.diagnostics[0].source).to.equal(errorSource);
        Utils.validateError(validationResult.diagnostics[0], { line: 0, character: 4 });
    });

    it("HelloWorldWithDocs.pq", () => {
        expectNoValidationErrors(Utils.documentFromFile("HelloWorldWithDocs.pq"));
    });

    it("DirectQueryForSQL.pq", () => {
        expectNoValidationErrors(Utils.documentFromFile("DirectQueryForSQL.pq"));
    });
});

describe("validation with workspace cache", () => {
    it("no errors after update", () => {
        const document: Utils.MockDocument = Utils.documentFromText("let a = 1,");
        const diagnostics: Diagnostic[] = validate(document, defaultValidationOptions).diagnostics;
        expect(diagnostics.length).to.be.greaterThan(0, "validation result is expected to have errors");

        const changes: TextDocumentContentChangeEvent[] = document.update("1");
        documentUpdated(document, changes, document.version);

        expectNoValidationErrors(document);
    });

    it("errors after update", () => {
        const document: Utils.MockDocument = Utils.documentFromText("let a = 1 in a");
        expectNoValidationErrors(document);

        const changes: TextDocumentContentChangeEvent[] = document.update(";;;;;;");
        documentUpdated(document, changes, document.version);

        const diagnostics: Diagnostic[] = validate(document, defaultValidationOptions).diagnostics;
        expect(diagnostics.length).to.be.greaterThan(0, "validation result is expected to have errors");
    });
});

describe("Duplicate identifiers", () => {
    it("let a = 1, a = 2 in a", () => {
        const document: Utils.MockDocument = Utils.documentFromText("let a = 1, a = 2 in a");
        validateDuplicateIdentifierDiagnostics(document, [
            {
                name: "a",
                position: { line: 0, character: 11 },
                relatedPositions: [
                    { line: 0, character: 4 },
                    { line: 0, character: 11 },
                ],
            },
        ]);
    });

    it("let rec = [ a = 1, b = 2, c = 3, a = 4] in rec", () => {
        const document: Utils.MockDocument = Utils.documentFromText("let rec = [ a = 1, b = 2, c = 3, a = 4] in rec");
        validateDuplicateIdentifierDiagnostics(document, [
            {
                name: "a",
                position: { line: 0, character: 33 },
                relatedPositions: [
                    { line: 0, character: 12 },
                    { line: 0, character: 33 },
                ],
            },
        ]);
    });

    // TODO: Figure out why this doesn't hit visitNode() record processing
    // it("[ a = 1, b = 2, c = 3, a = 4]", () => {
    //     const document: Utils.MockDocument = Utils.documentFromText("[ a = 1, b = 2, c = 3, a = 4]");
    //     const diagnostics: Diagnostic[] = validate(document).diagnostics;

    //     expect(diagnostics.length).to.equal(1, "");
    // });

    it('section foo; shared a = 1; a = "hello";', () => {
        const document: Utils.MockDocument = Utils.documentFromText('section foo; shared a = 1; a = "hello";');
        validateDuplicateIdentifierDiagnostics(document, [
            {
                name: "a",
                position: { line: 0, character: 27 },
                relatedPositions: [
                    { line: 0, character: 20 },
                    { line: 0, character: 27 },
                ],
            },
        ]);
    });

    it("section foo; shared a = let a = 1 in a; b = let b = 1, b = 2 in b;", () => {
        const document: Utils.MockDocument = Utils.documentFromText(
            "section foo; shared a = let a = 1 in a; b = let b = 1, b = 2, b = 3 in b;",
        );
        validateDuplicateIdentifierDiagnostics(document, [
            {
                name: "b",
                position: { line: 0, character: 55 },
                relatedPositions: [
                    { line: 0, character: 48 },
                    { line: 0, character: 55 },
                    { line: 0, character: 62 },
                ],
            },
            {
                name: "b",
                position: { line: 0, character: 62 },
                relatedPositions: [
                    { line: 0, character: 48 },
                    { line: 0, character: 55 },
                    { line: 0, character: 62 },
                ],
            },
        ]);
    });

    // TODO: Should the final a = 4 entry also show up as a duplicate?
    it("duplicates with syntax errors", () => {
        const document: Utils.MockDocument = Utils.documentFromText("section foo; a = 1; a = 2; b = let 1; a = 4;");
        validateDuplicateIdentifierDiagnostics(
            document,
            [
                {
                    name: "a",
                    position: { line: 0, character: 20 },
                    relatedPositions: [
                        { line: 0, character: 13 },
                        { line: 0, character: 20 },
                    ],
                },
            ],
            2 /* additional parser error expected */,
        );
    });

    it("let a = 1 meta [ abc = 1, abc = 3 ] in a", () => {
        const document: Utils.MockDocument = Utils.documentFromText("let a = 1 meta [ abc = 1, abc = 3 ] in a");
        validateDuplicateIdentifierDiagnostics(document, [
            {
                name: "abc",
                position: { line: 0, character: 26 },
                relatedPositions: [
                    { line: 0, character: 17 },
                    { line: 0, character: 26 },
                ],
            },
        ]);
    });

    it("let a = let abc = 1, abc = 2, b = 3 in b in a", () => {
        const document: Utils.MockDocument = Utils.documentFromText("let a = let abc = 1, abc = 2, b = 3 in b in a");
        validateDuplicateIdentifierDiagnostics(document, [
            {
                name: "abc",
                position: { line: 0, character: 21 },
                relatedPositions: [
                    { line: 0, character: 12 },
                    { line: 0, character: 21 },
                ],
            },
        ]);
    });

    it('section foo; a = let #"s p a c e" = 2, #"s p a c e" = 3, a = 2 in a;', () => {
        const document: Utils.MockDocument = Utils.documentFromText(
            'section foo; a = let #"s p a c e" = 2, #"s p a c e" = 3, a = 2 in a;',
        );
        validateDuplicateIdentifierDiagnostics(document, [
            {
                name: '#"s p a c e"',
                position: { line: 0, character: 39 },
                relatedPositions: [
                    { line: 0, character: 21 },
                    { line: 0, character: 39 },
                ],
            },
        ]);
    });
});

const defaultValidationOptions: ValidationOptions = {
    maintainWorkspaceCache: true,
};

function expectNoValidationErrors(document: TextDocument): void {
    const validationResult: ValidationResult = validate(document, defaultValidationOptions);
    expect(validationResult.syntaxError).to.equal(false, "syntaxError flag should be false");
    expect(validationResult.diagnostics.length).to.equal(0, "no diagnostics expected");
}

interface DuplicateIdentifierError {
    readonly name: string;
    readonly position: Position;
    readonly relatedPositions: Position[];
}

function validateDuplicateIdentifierDiagnostics(
    document: TextDocument,
    expected: DuplicateIdentifierError[],
    totalErrorCount?: number,
): void {
    const errorSource: string = "UNIT-TESTS";
    const diagnostics: Diagnostic[] = validate(document, {
        maintainWorkspaceCache: false,
        checkForDuplicateIdentifiers: true,
        source: errorSource,
    }).diagnostics;
    const actual: DuplicateIdentifierError[] = [];
    diagnostics.forEach(value => {
        if (value.code === DiagnosticErrorCode.DuplicateIdentifier) {
            const match: RegExpMatchArray | null = value.message.match(/'(.*?)'/);
            const name: string = match ? match[1] : "";

            if (!value.relatedInformation) {
                assert.fail("Duplicate Identifier error does not contain relatedInformation");
            }

            expect(value.source).to.equal(errorSource, "Unexpected source value on diagnostic");

            actual.push({
                name,
                position: value.range.start,
                relatedPositions: value.relatedInformation.map(relatedInfo => relatedInfo.location.range.start),
            });
        }
    });

    if (totalErrorCount) {
        expect(diagnostics.length).to.equal(totalErrorCount, "Total expected error count does not match");
    }

    expect(actual).deep.equals(
        expected,
        "Expected errors to match.\nactual:" + JSON.stringify(actual) + "\nexpected:" + JSON.stringify(expected),
    );
}

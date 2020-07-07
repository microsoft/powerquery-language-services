// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { expect } from "chai";
import "mocha";
import {
    Diagnostic,
    TextDocument,
    TextDocumentContentChangeEvent,
    ValidationOptions,
    ValidationResult,
} from "../../language-services";

import { documentUpdated, validate } from "../../language-services";
import * as Utils from "./utils";

const defaultValidationOptions: ValidationOptions = {
    maintainWorkspaceCache: true,
};

function expectNoValidationErrors(document: TextDocument): void {
    const validationResult: ValidationResult = validate(document, defaultValidationOptions);
    expect(validationResult.syntaxError).to.equal(false, "syntaxError flag should be false");
    expect(validationResult.diagnostics.length).to.equal(0, "no diagnostics expected");
}

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
        const diagnostics: Diagnostic[] = validate(document).diagnostics;

        expect(diagnostics.length).to.equal(0, "TODO - should report duplicates");
    });

    it("[ a = 1, b = 2, c = 3, a = 4 ]", () => {
        const document: Utils.MockDocument = Utils.documentFromText("[ a = 1, b = 2, c = 3, a = 4]");
        const diagnostics: Diagnostic[] = validate(document).diagnostics;

        expect(diagnostics.length).to.equal(0, "TODO - should report duplicates");
    });

    it('section foo; shared a = 1; a = "hello";', () => {
        const document: Utils.MockDocument = Utils.documentFromText('section foo; shared a = 1; a = "hello";');
        const diagnostics: Diagnostic[] = validate(document).diagnostics;

        expect(diagnostics.length).to.equal(0, "TODO - should report duplicates");
    });

    it("section foo; shared a = let a = 1 in a; b = let b = 1, b = 2 in b;", () => {
        const document: Utils.MockDocument = Utils.documentFromText(
            "section foo; shared a = let a = 1 in a; b = let b = 1, b = 2 in b;",
        );
        const diagnostics: Diagnostic[] = validate(document).diagnostics;

        expect(diagnostics.length).to.equal(1, "TODO - check errors");
    });
});

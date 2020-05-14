// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic } from "vscode-languageserver-types";

import { documentUpdated, validate } from "../../language-services";
import * as Utils from "./utils";

// TODO: more test cases
describe("validation", () => {
    it("no errors", () => {
        const document: TextDocument = Utils.documentFromText("let b = 1 in b");
        const diagnostics: Diagnostic[] = validate(document);
        expect(diagnostics.length).to.equal(0, "no diagnostics expected");
    });

    it("single line query with error", () => {
        const document: TextDocument = Utils.documentFromText("let 1");
        const diagnostics: Diagnostic[] = validate(document);
        expect(diagnostics.length).to.equal(1);
        Utils.validateError(diagnostics[0], { line: 0, character: 4 });
    });
});

describe("validation with workspace cache", () => {
    it("no errors after update", () => {
        const document: Utils.MockDocument = Utils.documentFromText("let a = 1,");
        let diagnostics: Diagnostic[] = validate(document);
        expect(diagnostics.length).to.be.greaterThan(0, "validation result is expected to have errors");

        document.setText("1");
        documentUpdated(document);

        diagnostics = validate(document);
        expect(diagnostics.length).to.equal(0, "no diagnostics expected");
    });

    it("errors after update", () => {
        const document: Utils.MockDocument = Utils.documentFromText("let a = 1 in a");
        let diagnostics: Diagnostic[] = validate(document);
        expect(diagnostics.length).to.equal(0, "no diagnostics expected");

        document.setText(";;;;;;");
        documentUpdated(document);

        diagnostics = validate(document);
        expect(diagnostics.length).to.be.greaterThan(0, "validation result is expected to have errors");
    });
});

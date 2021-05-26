// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import { expect } from "chai";
import "mocha";
import { TestConstants } from ".";

import {
    Analysis,
    AnalysisSettings,
    AnalysisUtils,
    CompletionItemKind,
    createTextDocument,
    DiagnosticSeverity,
    Hover,
    Position,
    SymbolKind,
    TextDocument,
} from "../powerquery-language-services";
import { SimpleLibrary } from "./testConstants";

describe("External consumption", () => {
    it("Analysis", async () => {
        const analysisSettings: AnalysisSettings = {
            createInspectionSettingsFn: () => TestConstants.SimpleInspectionSettings,
            maintainWorkspaceCache: false,
        };

        const textDocument: TextDocument = createTextDocument("id", 1, "let a = 1 in a");

        const position: Position = {
            character: 1,
            line: 0,
        };

        const analysis: Analysis = AnalysisUtils.createAnalysis(
            textDocument,
            analysisSettings,
            position,
            SimpleLibrary,
        );
        const hover: Hover = await analysis.getHover();

        expect(hover.range === undefined);
        expect(hover.contents === null);

        analysis.dispose();
    });

    it("CompletionItemKind", () => {
        expect(CompletionItemKind.Text).to.equal(1);
        expect(CompletionItemKind.Keyword).to.equal(14);
    });

    it("DiagnosticSeverity", () => {
        expect(DiagnosticSeverity.Error).to.equal(1);
        expect(DiagnosticSeverity.Warning).to.equal(2);
        expect(DiagnosticSeverity.Information).to.equal(3);
        expect(DiagnosticSeverity.Hint).to.equal(4);
    });

    it("SymbolKind", () => {
        expect(SymbolKind.Function).to.equal(12);
        expect(SymbolKind.Constant).to.equal(14);
    });
});

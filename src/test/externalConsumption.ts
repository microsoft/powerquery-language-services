// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { expect } from "chai";
import "mocha";

// We should only import from the library index
import * as LanguageServices from "../powerquery-language-services";
import * as AnalysisUtils from "../powerquery-language-services/analysis/analysisUtils";

import {
    Analysis,
    AnalysisOptions,
    CompletionItemKind,
    DiagnosticSeverity,
    Hover,
    Position,
    SymbolKind,
    TextDocument,
} from "../powerquery-language-services";

describe("External consumption", () => {
    it("Analysis", async () => {
        const options: AnalysisOptions = {
            locale: "en-us",
            maintainWorkspaceCache: false,
        };

        const textDocument: TextDocument = LanguageServices.createTextDocument("id", 1, "let a = 1 in a");

        const position: Position = {
            character: 1,
            line: 0,
        };

        const analysis: Analysis = AnalysisUtils.createAnalysis(textDocument, position, options);
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

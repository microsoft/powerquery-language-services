// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

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
import { TestConstants } from ".";

describe("External consumption", () => {
    it("Analysis", async () => {
        const analysisSettings: AnalysisSettings = {
            inspectionSettings: TestConstants.SimpleInspectionSettings,
            isWorkspaceCacheAllowed: false,
            traceManager: NoOpTraceManagerInstance,
            initialCorrelationId: undefined,
        };

        const textDocument: TextDocument = createTextDocument("id", 1, "let a = 1 in a");

        const position: Position = {
            character: 1,
            line: 0,
        };

        const analysis: Analysis = AnalysisUtils.createAnalysis(textDocument, analysisSettings);

        const hover: Result<Hover | undefined, CommonError.CommonError> = await analysis.getHover(
            position,
            TestConstants.NoOpCancellationTokenInstance,
        );

        Assert.isOk(hover);
        Assert.isUndefined(hover.value);

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

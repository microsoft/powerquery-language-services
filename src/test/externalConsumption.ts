// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, NoOpCancellationToken, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import {
    Analysis,
    AnalysisSettings,
    AnalysisUtils,
    CompletionItemKind,
    DiagnosticSeverity,
    Hover,
    Position,
    SymbolKind,
    textDocument,
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

        const position: Position = {
            character: 1,
            line: 0,
        };

        const analysis: Analysis = AnalysisUtils.analysis(textDocument("id", 1, "let a = 1 in a"), analysisSettings);

        const hover: Result<Hover | undefined, CommonError.CommonError> = await analysis.getHover(
            position,
            NoOpCancellationToken,
        );

        ResultUtils.assertIsOk(hover);
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

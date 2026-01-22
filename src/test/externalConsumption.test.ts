// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    Assert,
    type CommonError,
    NoOpCancellationToken,
    type Result,
    ResultUtils,
} from "@microsoft/powerquery-parser";
import { describe, expect, it } from "bun:test";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import {
    type Analysis,
    type AnalysisSettings,
    AnalysisUtils,
    CompletionItemKind,
    DiagnosticSeverity,
    type Hover,
    type Position,
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
        expect(CompletionItemKind.Text).toBe(1);
        expect(CompletionItemKind.Keyword).toBe(14);
    });

    it("DiagnosticSeverity", () => {
        expect(DiagnosticSeverity.Error).toBe(1);
        expect(DiagnosticSeverity.Warning).toBe(2);
        expect(DiagnosticSeverity.Information).toBe(3);
        expect(DiagnosticSeverity.Hint).toBe(4);
    });

    it("SymbolKind", () => {
        expect(SymbolKind.Function).toBe(12);
        expect(SymbolKind.Constant).toBe(14);
    });
});

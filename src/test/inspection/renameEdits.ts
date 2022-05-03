// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { assertGetInspectionInstance } from "../testUtils";
import { expect } from "chai";
import { Inspected } from "../../powerquery-language-services/inspection";

import type { Position, Range, TextEdit } from "vscode-languageserver-types";
import { TestConstants, TestUtils } from "..";
import { AnalysisBase } from "../../powerquery-language-services";

type PartialAnalysis = Pick<AnalysisBase, "getRenameEdits">;

class RenameEditsAnalysis extends AnalysisBase {
    constructor(promiseMaybeInspected: Promise<Inspected | undefined>) {
        super(
            {
                createInspectionSettingsFn: undefined as any,
                library: {
                    externalTypeResolver: undefined as any,
                    libraryDefinitions: undefined as any,
                },
            },
            promiseMaybeInspected,
        );
    }

    dispose(): void {
        // noop
    }

    getText(_range?: Range): string {
        return "";
    }
}

describe(`Inspection - RenameEdits - Identifiers`, () => {
    describe("Rename identifiers", () => {
        const assertExpectedTextEdits: (textEdits: TextEdit[], nextStr: string) => void = (
            textEdits: TextEdit[],
            nextStr: string,
        ) => {
            expect(textEdits.length).eq(2);
            expect(textEdits[0].newText).eq(nextStr);
            expect(textEdits[0].range.start.line).eq(0);
            expect(textEdits[0].range.start.character).eq(272);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(273);
            expect(textEdits[1].newText).eq(nextStr);
            expect(textEdits[1].range.start.line).eq(0);
            expect(textEdits[1].range.start.character).eq(222);
            expect(textEdits[1].range.end.line).eq(0);
            expect(textEdits[1].range.end.character).eq(223);
        };

        it(`Rename one in-expression identifier`, async () => {
            const rawText: string = [
                "let",
                '_message = if (message <> null) then message else "(no message)",',
                '#"message 1#" = if (message <> null) then message else "(no message 1)",',
                '#"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",',
                'a = "Hello from ThirdPQConn: " & #"message 3#"',
                "in",
                "a|",
            ].join(" ");

            const nextStr: string = "a1";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            assertExpectedTextEdits(textEdits, nextStr);
        });

        it(`Rename one in-expression identifier from left`, async () => {
            const rawText: string = [
                "let",
                '_message = if (message <> null) then message else "(no message)",',
                '#"message 1#" = if (message <> null) then message else "(no message 1)",',
                '#"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",',
                'a = "Hello from ThirdPQConn: " & #"message 3#"',
                "in",
                "|a",
            ].join(" ");

            const nextStr: string = "a2";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            assertExpectedTextEdits(textEdits, nextStr);
        });

        it(`Rename one constructor identifier`, async () => {
            const rawText: string = [
                "let",
                '_message = if (message <> null) then message else "(no message)",',
                '#"message 1#" = if (message <> null) then message else "(no message 1)",',
                '#"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",',
                'a| = "Hello from ThirdPQConn: " & #"message 3#"',
                "in",
                "a",
            ].join(" ");

            const nextStr: string = "a3";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            assertExpectedTextEdits(textEdits, nextStr);
        });

        it(`Rename one constructor identifier from left`, async () => {
            const rawText: string = [
                "let",
                '_message = if (message <> null) then message else "(no message)",',
                '#"message 1#" = if (message <> null) then message else "(no message 1)",',
                '#"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",',
                '|a = "Hello from ThirdPQConn: " & #"message 3#"',
                "in",
                "a",
            ].join(" ");

            const nextStr: string = "a4";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            assertExpectedTextEdits(textEdits, nextStr);
        });
    });

    describe("Rename generalized identifiers", () => {
        const assertExpectedRecordTextEdits: (textEdits: TextEdit[], nextStr: string) => void = (
            textEdits: TextEdit[],
            nextStr: string,
        ) => {
            expect(textEdits.length).eq(2);
            expect(textEdits[0].newText).eq(nextStr);
            expect(textEdits[0].range.start.line).eq(0);
            expect(textEdits[0].range.start.character).eq(4);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(7);
            expect(textEdits[1].newText).eq(nextStr);
            expect(textEdits[1].range.start.line).eq(0);
            expect(textEdits[1].range.start.character).eq(78);
            expect(textEdits[1].range.end.line).eq(0);
            expect(textEdits[1].range.end.character).eq(81);
        };

        it(`Rename one record-expression identifier`, async () => {
            const rawText: string = [
                "let",
                "foo = 1,",
                "bar = 1,",
                "ThirdPQConn = [",
                "Authentication = [",
                "Implicit = [],",
                "foo = foo|",
                "],",
                'Label = Extension.LoadString("DataSourceLabel")',
                "]",
                "in",
                "ThirdPQConn",
            ].join(" ");

            const nextStr: string = "foo1";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            assertExpectedRecordTextEdits(textEdits, nextStr);
        });

        it(`Rename one identifier in its paired assignment expression creator`, async () => {
            const rawText: string = [
                "let",
                "|foo = 1,",
                "bar = 1,",
                "ThirdPQConn = [",
                "Authentication = [",
                "Implicit = [],",
                "foo = foo",
                "],",
                'Label = Extension.LoadString("DataSourceLabel")',
                "]",
                "in",
                "ThirdPQConn",
            ].join(" ");

            const nextStr: string = "foo2";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            assertExpectedRecordTextEdits(textEdits, nextStr);
        });

        it(`Rename one record-expression identifier creator`, async () => {
            const rawText: string = [
                "let",
                "foo = 1,",
                "bar = 1,",
                "ThirdPQConn = [",
                "Authentication = [",
                "Implicit = [],",
                "|foo = foo",
                "],",
                'Label = Extension.LoadString("DataSourceLabel")',
                "]",
                "in",
                "ThirdPQConn",
            ].join(" ");

            const nextStr: string = "foo2";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            expect(textEdits.length).eq(1);
            expect(textEdits[0].newText).eq(nextStr);
            expect(textEdits[0].range.start.line).eq(0);
            expect(textEdits[0].range.start.character).eq(72);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(75);
        });

        it(`Rename one identifier within a statement`, async () => {
            const rawText: string = [
                "let",
                "foo| = 1,",
                "bar = 1,",
                "ThirdPQConn = [",
                "Authentication = [",
                "Implicit = [],",
                "foo = foo",
                "],",
                'Label = Extension.LoadString("DataSourceLabel")',
                "]",
                "in",
                "ThirdPQConn",
            ].join(" ");

            const nextStr: string = "foo3";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            expect(textEdits.length).eq(2);
            expect(textEdits[0].newText).eq(nextStr);
            expect(textEdits[0].range.start.line).eq(0);
            expect(textEdits[0].range.start.character).eq(4);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(7);
            expect(textEdits[1].newText).eq(nextStr);
            expect(textEdits[1].range.start.line).eq(0);
            expect(textEdits[1].range.start.character).eq(78);
            expect(textEdits[1].range.end.line).eq(0);
            expect(textEdits[1].range.end.character).eq(81);
        });

        const assertExpectedRecordTextEditsWithAtSymbols: (textEdits: TextEdit[], nextStr: string) => void = (
            textEdits: TextEdit[],
            nextStr: string,
        ) => {
            expect(textEdits.length).eq(2);
            expect(textEdits[0].newText).eq(nextStr);
            expect(textEdits[0].range.start.line).eq(0);
            expect(textEdits[0].range.start.character).eq(57);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(65);
            expect(textEdits[1].newText).eq(nextStr);
            expect(textEdits[1].range.start.line).eq(0);
            expect(textEdits[1].range.start.character).eq(79);
            expect(textEdits[1].range.end.line).eq(0);
            expect(textEdits[1].range.end.character).eq(87);
        };

        it(`Rename one generalized identifier within a statement with constant at symbol`, async () => {
            const rawText: string = [
                "let",
                "foo = 1,",
                "bar = 1,",
                "ThirdPQConn = [",
                "Authentication = [",
                "|Implicit = [],",
                "foo = @Implicit",
                "],",
                'Label = Extension.LoadString("DataSourceLabel")',
                "]",
                "in",
                "ThirdPQConn",
            ].join(" ");

            const nextStr: string = "Implicit4";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            assertExpectedRecordTextEditsWithAtSymbols(textEdits, nextStr);
        });

        it(`Rename one referred generalized identifier within a statement with constant at symbol`, async () => {
            const rawText: string = [
                "let",
                "foo = 1,",
                "bar = 1,",
                "ThirdPQConn = [",
                "Authentication = [",
                "Implicit = [],",
                "foo = @Implicit|",
                "],",
                'Label = Extension.LoadString("DataSourceLabel")',
                "]",
                "in",
                "ThirdPQConn",
            ].join(" ");

            const nextStr: string = "Implicit4";

            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

            const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            const partialAnalysis: PartialAnalysis = new RenameEditsAnalysis(currentInspectDeferred);

            const textEdits: TextEdit[] = await partialAnalysis.getRenameEdits(nextStr);

            assertExpectedRecordTextEditsWithAtSymbols(textEdits, nextStr);
        });
    });
});

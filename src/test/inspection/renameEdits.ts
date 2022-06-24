// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import type { Position, Range, TextEdit } from "vscode-languageserver-types";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import {
    ActiveNode,
    ActiveNodeKind,
    Inspected,
    InspectionInstance,
} from "../../powerquery-language-services/inspection";
import { TestConstants, TestUtils } from "..";
import { AnalysisBase } from "../../powerquery-language-services";
import { assertGetInspectionInstance } from "../testUtils";
import { findDirectUpperScopeExpression } from "../../powerquery-language-services/inspection/scope/scopeUtils";
import { NodeKind } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/ast/ast";

type PartialAnalysis = Pick<AnalysisBase, "getRenameEdits">;

class RenameEditsAnalysis extends AnalysisBase {
    constructor(promiseMaybeInspected: Promise<Inspected | undefined>) {
        super(
            undefined as any,
            {
                createInspectionSettingsFn: undefined as any,
                isWorkspaceCacheAllowed: false,
                library: {
                    externalTypeResolver: undefined as any,
                    libraryDefinitions: undefined as any,
                },
                traceManager: NoOpTraceManagerInstance,
                maybeInitialCorrelationId: undefined,
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
            expect(textEdits[0].range.start.character).eq(364);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(365);
            expect(textEdits[1].newText).eq(nextStr);
            expect(textEdits[1].range.start.line).eq(0);
            expect(textEdits[1].range.start.character).eq(286);
            expect(textEdits[1].range.end.line).eq(0);
            expect(textEdits[1].range.end.character).eq(287);
        };

        it(`Rename one in-expression identifier`, async () => {
            const rawText: string = `let
                _message = if (message <> null) then message else "(no message)",
                #"message 1#" = if (message <> null) then message else "(no message 1)",
                #"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",
                a = "Hello from ThirdPQConn: " & #"message 3#"
            in
                a|`.replace(/(\r\n|\n)/g, " ");

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
            const rawText: string = `let
                _message = if (message <> null) then message else "(no message)",
                #"message 1#" = if (message <> null) then message else "(no message 1)",
                #"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",
                a = "Hello from ThirdPQConn: " & #"message 3#"
            in
                |a`.replace(/(\r\n|\n)/g, " ");

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
            const rawText: string = `let
                _message = if (message <> null) then message else "(no message)",
                #"message 1#" = if (message <> null) then message else "(no message 1)",
                #"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",
                a| = "Hello from ThirdPQConn: " & #"message 3#"
            in
                a`.replace(/(\r\n|\n)/g, " ");

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
            const rawText: string = `let
                _message = if (message <> null) then message else "(no message)",
                #"message 1#" = if (message <> null) then message else "(no message 1)",
                #"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",
                |a = "Hello from ThirdPQConn: " & #"message 3#"
            in
                a`.replace(/(\r\n|\n)/g, " ");

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
            expect(textEdits[0].range.start.character).eq(20);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(23);
            expect(textEdits[1].newText).eq(nextStr);
            expect(textEdits[1].range.start.line).eq(0);
            expect(textEdits[1].range.start.character).eq(186);
            expect(textEdits[1].range.end.line).eq(0);
            expect(textEdits[1].range.end.character).eq(189);
        };

        it(`Rename one record-expression identifier`, async () => {
            const rawText: string = `let
                foo = 1,
                bar = 1,
                ThirdPQConn = [
                    Authentication = [
                    Implicit = [],
                    foo = foo|
                ],
                Label = Extension.LoadString("DataSourceLabel")
                ]
            in
                ThirdPQConn`.replace(/(\r\n|\n)/g, " ");

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
            const rawText: string = `let
                |foo = 1,
                bar = 1,
                ThirdPQConn = [
                    Authentication = [
                    Implicit = [],
                    foo = foo
                ],
                Label = Extension.LoadString("DataSourceLabel")
                ]
            in
                ThirdPQConn`.replace(/(\r\n|\n)/g, " ");

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
            const rawText: string = `let
                foo = 1,
                bar = 1,
                ThirdPQConn = [
                    Authentication = [
                    Implicit = [],
                    |foo = foo
                ],
                Label = Extension.LoadString("DataSourceLabel")
                ]
            in
                ThirdPQConn`.replace(/(\r\n|\n)/g, " ");

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
            expect(textEdits[0].range.start.character).eq(180);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(183);
        });

        it(`Rename one identifier within a statement`, async () => {
            const rawText: string = `let
                foo| = 1,
                bar = 1,
                ThirdPQConn = [
                    Authentication = [
                    Implicit = [],
                    foo = foo
                ],
                Label = Extension.LoadString("DataSourceLabel")
                ]
            in
                ThirdPQConn`.replace(/(\r\n|\n)/g, " ");

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
            expect(textEdits[0].range.start.character).eq(20);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(23);
            expect(textEdits[1].newText).eq(nextStr);
            expect(textEdits[1].range.start.line).eq(0);
            expect(textEdits[1].range.start.character).eq(186);
            expect(textEdits[1].range.end.line).eq(0);
            expect(textEdits[1].range.end.character).eq(189);
        });

        const assertExpectedRecordTextEditsWithAtSymbols: (textEdits: TextEdit[], nextStr: string) => void = (
            textEdits: TextEdit[],
            nextStr: string,
        ) => {
            expect(textEdits.length).eq(2);
            expect(textEdits[0].newText).eq(nextStr);
            expect(textEdits[0].range.start.line).eq(0);
            expect(textEdits[0].range.start.character).eq(149);
            expect(textEdits[0].range.end.line).eq(0);
            expect(textEdits[0].range.end.character).eq(157);
            expect(textEdits[1].newText).eq(nextStr);
            expect(textEdits[1].range.start.line).eq(0);
            expect(textEdits[1].range.start.character).eq(195);
            expect(textEdits[1].range.end.line).eq(0);
            expect(textEdits[1].range.end.character).eq(203);
        };

        it(`Rename one generalized identifier within a statement with constant at symbol`, async () => {
            const rawText: string = `let
                foo = 1,
                bar = 1,
                ThirdPQConn = [
                    Authentication = [
                        |Implicit = [],
                        foo = @Implicit
                    ],  
                    Label = Extension.LoadString("DataSourceLabel")
                ]
            in
                ThirdPQConn`.replace(/(\r\n|\n)/g, " ");

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
            const rawText: string = `let
                foo = 1,
                bar = 1,
                ThirdPQConn = [
                    Authentication = [
                        Implicit = [],
                        foo = @Implicit|
                    ],  
                    Label = Extension.LoadString("DataSourceLabel")
                ]
            in
                ThirdPQConn`.replace(/(\r\n|\n)/g, " ");

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

    describe("Utils relating to renameEdits", () => {
        describe("findDirectUpperScopeExpression", () => {
            (
                [
                    // ["SectionMember", `section foo; x| = 1; y = 2; z = let a = x in a;`, NodeKind.SectionMember],
                    // [
                    //     "RecordLiteral",
                    //     `section foo; [u| = "v" ]shared x = 1; y = 2; z = let a = x in a;`,
                    //     NodeKind.RecordLiteral,
                    // ],
                    // [
                    //     "RecordExpression",
                    //     `[
                    //         |a = "yoo"
                    //     ]`,
                    //     NodeKind.RecordExpression,
                    // ],
                    // ["LetExpression", `let a| = x in a`, NodeKind.LetExpression],
                    ["WIP FunctionExpression", `(a|) => let x  = a in x`, NodeKind.FunctionExpression],
                    // ["EachExpression", `each x|;`, NodeKind.EachExpression],
                    // ["undefined", `x| + 1`, undefined],
                ] as Array<[string, string, NodeKind | undefined]>
            ).forEach(([nodeKindString, rawTextString, nodeKind]: [string, string, NodeKind | undefined]) => {
                it(`Find ${nodeKindString}`, async () => {
                    const rawText: string = rawTextString.replace(/(\r\n|\n)/g, " ");

                    const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(rawText);

                    const currentInspectDeferred: Promise<Inspected> = assertGetInspectionInstance(
                        TestConstants.DefaultInspectionSettings,
                        text,
                        position,
                    );

                    const inspectionInstance: InspectionInstance = (await currentInspectDeferred) as InspectionInstance;

                    expect(inspectionInstance.maybeActiveNode.kind).eq(ActiveNodeKind.ActiveNode);

                    const res: Ast.TNode | undefined = findDirectUpperScopeExpression(
                        inspectionInstance.nodeIdMapCollection,
                        (inspectionInstance.maybeActiveNode as ActiveNode).maybeInclusiveIdentifierUnderPosition?.node
                            ?.id as number,
                    );

                    expect(res?.kind).eq(nodeKind);
                });
            });
        });
    });
});

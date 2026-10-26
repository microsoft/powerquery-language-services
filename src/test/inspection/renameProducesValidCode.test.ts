// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Task, TaskUtils } from "@microsoft/powerquery-parser";
import { TextDocument, TextEdit } from "vscode-languageserver-textdocument";
import { expect } from "chai";

import { TestConstants, TestUtils } from "..";

describe("Analysis - rename edits", () => {
    for (const [newName, expected] of [
        ["my value", 'let #"my value" = 1 in #"my value"'],
        ["if", 'let #"if" = 1 in #"if"'],
        ["null", 'let #"null" = 1 in #"null"'],
        ['a"b', 'let #"a""b" = 1 in #"a""b"'],
        ["a#b", 'let #"a#(#)b" = 1 in #"a#(#)b"'],
        ['#"foo"junk', 'let #"#(#)""foo""junk" = 1 in #"#(#)""foo""junk"'],
        ['#"foo"junk"', 'let #"#(#)""foo""junk""" = 1 in #"#(#)""foo""junk"""'],
        ['#"my value"', 'let #"my value" = 1 in #"my value"'],
    ]) {
        it(`produces parseable code when renaming to ${newName}`, async () => {
            const textWithPipe: string = "let foo = 1 in foo|";
            const [text]: [string, { line: number; character: number }] = TestUtils.extractPosition(textWithPipe);

            const edits: TextEdit[] | undefined = await TestUtils.assertRenameEdits({
                textWithPipe,
                newName,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
            });

            expect(edits).to.have.length(2);

            const renamed: string = TextDocument.applyEdits(TestUtils.mockDocument(text), edits!);
            expect(renamed).to.equal(expected);

            const result: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                TestConstants.SimpleInspectionSettings,
                renamed,
            );

            expect(TaskUtils.isParseStageOk(result), renamed).to.equal(true);
        });
    }
});

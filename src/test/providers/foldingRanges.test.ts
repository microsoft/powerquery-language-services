// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { Task } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "..";
import { createFoldingRanges } from "../../powerquery-language-services/providers/localDocumentProvider/foldingRanges";

describe("Folding ranges", () => {
    it("preserves node-kind order rather than sorting by source position", async () => {
        const parsed: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse({
            text: "let\nf = () =>\nif true then\n1\nelse 2,\nx = {\n1,\n2\n}\nin x",
            settings: TestConstants.DefaultInspectionSettings,
        });

        expect(
            createFoldingRanges(parsed.nodeIdMapCollection, TestConstants.DefaultInspectionSettings.traceManager, 0),
        ).to.deep.equal([
            { startCharacter: 4, startLine: 1, endCharacter: 6, endLine: 4 },
            { startCharacter: 0, startLine: 2, endCharacter: 6, endLine: 4 },
            { startCharacter: 0, startLine: 0, endCharacter: 4, endLine: 9 },
            { startCharacter: 4, startLine: 5, endCharacter: 1, endLine: 8 },
        ]);
    });
});

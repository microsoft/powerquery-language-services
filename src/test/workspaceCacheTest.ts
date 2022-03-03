// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import { Inspection, TextDocument, WorkspaceCacheUtils } from "../powerquery-language-services";
import { assertIsOk } from "@microsoft/powerquery-parser/lib/powerquery-parser/task/taskUtils";
import { isDefined } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/assert";
import type { Position } from "vscode-languageserver-types";

import * as PQLS from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";
import { SimpleLibrary } from "./testConstants";
import { TestUtils } from ".";

describe("workspaceCache", () => {
    it("getOrCreateLexPromise", async () => {
        const text: string = `let\n   b = 1\n   in b`;

        const cacheItem: PQP.Task.TriedLexTask = await WorkspaceCacheUtils.getOrCreateLexPromise(
            TestUtils.createTextMockDocument(text),
            PQP.DefaultSettings,
        );

        assertIsOk(cacheItem);
    });

    it("getOrCreateParsePromise", async () => {
        const text: string = "let c = 1 in c";

        const cacheItem: PQP.Task.TriedParseTask | undefined = await WorkspaceCacheUtils.getOrCreateParsePromise(
            TestUtils.createTextMockDocument(text),
            PQP.DefaultSettings,
        );

        isDefined(cacheItem);
    });

    it("getOrCreateParsePromise with error", async () => {
        const text: string = "let c = 1, in c";

        const cacheItem: PQP.Task.TriedParseTask | undefined = await WorkspaceCacheUtils.getOrCreateParsePromise(
            TestUtils.createTextMockDocument(text),
            PQP.DefaultSettings,
        );

        isDefined(cacheItem);
    });

    it("getOrCreateInspectionPromise", async () => {
        const [document, postion]: [MockDocument, Position] =
            TestUtils.createMockDocumentAndPosition("let c = 1 in |c");

        const cacheItem: Inspection.Inspection | undefined = await WorkspaceCacheUtils.getOrCreateInspectionPromise(
            document,
            PQLS.InspectionUtils.createInspectionSettings(
                PQP.DefaultSettings,
                undefined,
                SimpleLibrary.externalTypeResolver,
            ),
            postion,
        );

        TestUtils.assertIsDefined(cacheItem);
    });

    it("getOrCreateInspectionPromise with parser error", async () => {
        const [document, postion]: [MockDocument, Position] =
            TestUtils.createMockDocumentAndPosition("let c = 1, in |");

        const cacheItem: Inspection.Inspection | undefined = await WorkspaceCacheUtils.getOrCreateInspectionPromise(
            document,
            PQLS.InspectionUtils.createInspectionSettings(
                PQP.DefaultSettings,
                undefined,
                SimpleLibrary.externalTypeResolver,
            ),
            postion,
        );

        TestUtils.assertIsDefined(cacheItem);
    });
});

describe("top level workspace functions", () => {
    it("document operations", () => {
        const document: TextDocument = TestUtils.createTextMockDocument("let c = 1 in c");
        PQLS.documentUpdated(document, [], document.version + 1);
        PQLS.documentUpdated(document, [], document.version + 2);
        PQLS.documentClosed(document);
        PQLS.documentClosed(document);
        PQLS.documentUpdated(document, [], document.version);
    });
});

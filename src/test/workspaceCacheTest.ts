// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import * as PQP from "@microsoft/powerquery-parser";
import { Inspection, TextDocument, WorkspaceCache, WorkspaceCacheUtils } from "../powerquery-language-services";
import { assertIsOk } from "@microsoft/powerquery-parser/lib/powerquery-parser/task/taskUtils";
import { isDefined } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/assert";
import type { Position } from "vscode-languageserver-types";

import * as PQLS from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";
import { SimpleLibrary } from "./testConstants";
import { TestUtils } from ".";

describe("workspaceCache", () => {
    describe(`getOrCreate`, () => {
        it("getOrCreateLexPromise", async () => {
            const text: string = `let\n   b = 1\n   in b`;

            const cacheItem: PQP.Task.TriedLexTask = await WorkspaceCacheUtils.getOrCreateLexPromise(
                TestUtils.createTextMockDocument(text),
                PQP.DefaultSettings,
                false,
            );

            assertIsOk(cacheItem);
        });

        it("getOrCreateParsePromise", async () => {
            const text: string = "let c = 1 in c";

            const cacheItem: PQP.Task.TriedParseTask | undefined = await WorkspaceCacheUtils.getOrCreateParsePromise(
                TestUtils.createTextMockDocument(text),
                PQP.DefaultSettings,
                false,
            );

            isDefined(cacheItem);
        });

        it("getOrCreateParsePromise with error", async () => {
            const text: string = "let c = 1, in c";

            const cacheItem: PQP.Task.TriedParseTask | undefined = await WorkspaceCacheUtils.getOrCreateParsePromise(
                TestUtils.createTextMockDocument(text),
                PQP.DefaultSettings,
                false,
            );

            isDefined(cacheItem);
        });

        it("getOrCreateInspectionPromise", async () => {
            const [document, postion]: [MockDocument, Position] =
                TestUtils.createMockDocumentAndPosition("let c = 1 in |c");

            const maybeInspected: Inspection.Inspected | undefined =
                await WorkspaceCacheUtils.getOrCreateInspectedPromise(
                    document,
                    PQLS.InspectionUtils.createInspectionSettings(PQP.DefaultSettings, { library: SimpleLibrary }),
                    postion,
                );

            TestUtils.assertIsDefined(maybeInspected);
        });

        it("getOrCreateInspectionPromise with parser error", async () => {
            const [document, postion]: [MockDocument, Position] =
                TestUtils.createMockDocumentAndPosition("let c = 1, in |");

            const maybeInspected: Inspection.Inspected | undefined =
                await WorkspaceCacheUtils.getOrCreateInspectedPromise(
                    document,
                    PQLS.InspectionUtils.createInspectionSettings(PQP.DefaultSettings),
                    postion,
                );

            TestUtils.assertIsDefined(maybeInspected);
        });
    });

    describe(`isWorkspaceCacheAllowed`, () => {
        it(`doesn't set a value when disallowed`, async () => {
            const document: MockDocument = TestUtils.createTextMockDocument("foo");

            TestUtils.assertIsDefined(
                await WorkspaceCacheUtils.getOrCreateParsePromise(document, PQP.DefaultSettings, false),
                "expected to be parsed",
            );

            const cacheCollection: WorkspaceCache.CacheCollection = WorkspaceCacheUtils.getOrCreateCacheCollection(
                document,
                true,
            );

            expect(cacheCollection.maybeParse).to.be.undefined;
        });

        it(`sets a value when allowed`, async () => {
            const document: MockDocument = TestUtils.createTextMockDocument("foo");

            TestUtils.assertIsDefined(
                await WorkspaceCacheUtils.getOrCreateParsePromise(document, PQP.DefaultSettings, true),
                "expected to be parsed",
            );

            const cacheCollection: WorkspaceCache.CacheCollection = WorkspaceCacheUtils.getOrCreateCacheCollection(
                document,
                true,
            );

            expect(cacheCollection.maybeParse).to.not.be.undefined;
        });

        it(`fetches an empty collection when caching is disallowed`, async () => {
            const document: MockDocument = TestUtils.createTextMockDocument("foo");

            TestUtils.assertIsDefined(
                await WorkspaceCacheUtils.getOrCreateParsePromise(document, PQP.DefaultSettings, true),
                "expected to be parsed",
            );

            const cacheCollection: WorkspaceCache.CacheCollection = WorkspaceCacheUtils.getOrCreateCacheCollection(
                document,
                false,
            );

            expect(cacheCollection.maybeParse).to.be.undefined;
        });
    });

    it("cache invalidation with version change", async () => {
        const [document, postion]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition("foo|");

        let maybeInspected: Inspection.Inspected | undefined = await WorkspaceCacheUtils.getOrCreateInspectedPromise(
            document,
            PQLS.InspectionUtils.createInspectionSettings(PQP.DefaultSettings, { library: SimpleLibrary }),
            postion,
        );

        TestUtils.assertIsDefined(maybeInspected);

        let cacheCollection: WorkspaceCache.CacheCollection = WorkspaceCacheUtils.getOrCreateCacheCollection(
            document,
            false,
        );

        expect(cacheCollection.version).to.equal(0);

        document.setText("bar");

        maybeInspected = await WorkspaceCacheUtils.getOrCreateInspectedPromise(
            document,
            PQLS.InspectionUtils.createInspectionSettings(PQP.DefaultSettings, { library: SimpleLibrary }),
            postion,
        );

        TestUtils.assertIsDefined(maybeInspected);

        cacheCollection = WorkspaceCacheUtils.getOrCreateCacheCollection(document, false);

        expect(cacheCollection.version).to.equal(1);
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

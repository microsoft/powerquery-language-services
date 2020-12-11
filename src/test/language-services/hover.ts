// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { assert, expect } from "chai";
import "mocha";
import { AnalysisOptions, Hover } from "../../powerquery-language-services";

import * as Utils from "./utils";

const libraryProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider([
    "DateTime.FixedLocalNow",
    "DateTime.LocalNow",
    "Text.NewGuid",
]);

const emptySymbolProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider([]);

async function expectHover(text: string, expected: string, analysisOptions?: AnalysisOptions): Promise<void> {
    const options: AnalysisOptions = analysisOptions ?? {
        librarySymbolProvider: libraryProvider,
    };

    const hover: Hover = await Utils.getHover(text, options);

    assert.isDefined(hover.range);
    assert.isDefined(hover.contents);
    expect(hover.contents.toString()).contains(expected);
}

async function expectEmpty(text: string, analysisOptions?: AnalysisOptions): Promise<void> {
    const options: AnalysisOptions = analysisOptions ?? {
        librarySymbolProvider: libraryProvider,
    };

    const hover: Hover = await Utils.getHover(text, options);
    expect(hover).deep.equals(Utils.emptyHover);
}

describe("Hover", () => {
    it("Not an identifier", async () => expectEmpty('let a = "not iden|tifier" in a'));
    it("Keyword hover", async () => expectEmpty('le|t a = "not identifier" in a'));
    it("After identifier", async () => expectEmpty("let\r\nabc = Text.NewGuid()| in abc"));
    it("No provider", async () => expectEmpty("let abc = Text.NewGu|id() in abc", {}));

    it("Simple provider", async () => expectHover("let abc = Text.NewGu|id() in abc", "Text.NewGuid"));
    it("Before .", async () => expectHover("let abc = Text|.NewGuid() in abc", "Text.NewGuid"));
    it("After .", async () => expectHover("let abc = Text.|NewGuid() in abc", "Text.NewGuid"));

    it("Two providers, one empty", async () =>
        expectHover("let abc = Text.|NewGuid() in abc", "Text.NewGuid", {
            librarySymbolProvider: libraryProvider,
            environmentSymbolProvider: emptySymbolProvider,
        }));

    it("Environment provider", async () =>
        expectHover("let abc = Text.|NewGuid() in abc", "Text.NewGuid", {
            environmentSymbolProvider: libraryProvider,
        }));
});

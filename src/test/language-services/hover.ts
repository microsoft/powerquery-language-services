// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { assert, expect } from "chai";
import "mocha";
import { MarkedString, MarkupContent } from "vscode-languageserver-types";

import * as Utils from "./utils";

import { AnalysisOptions, Hover } from "../../powerquery-language-services";

const libraryProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider([
    "DateTime.FixedLocalNow",
    "DateTime.LocalNow",
    "Text.NewGuid",
]);

const EmptySymbolProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider([]);

async function expectHoverContents(hover: Hover): Promise<string> {
    const contents: MarkupContent | MarkedString | MarkedString[] = hover.contents;

    if (typeof contents === "string") {
        return contents;
    } else if (MarkupContent.is(contents) || MarkedString.is(contents)) {
        return contents.value;
    } else {
        throw new Error(`unknown hover kind`);
    }
}

async function expectHover(text: string, expected: string, analysisOptions?: AnalysisOptions): Promise<void> {
    const options: AnalysisOptions = analysisOptions ?? {
        librarySymbolProvider: libraryProvider,
    };

    const hover: Hover = await Utils.getHover(text, options);

    assert.isUndefined(hover.range);
    assert.isDefined(hover.contents);

    const contents: string = await expectHoverContents(hover);
    expect(contents).equals(expected);
}

async function expectUnknownHover(text: string, analysisOptions?: AnalysisOptions): Promise<void> {
    const options: AnalysisOptions = analysisOptions ?? {
        librarySymbolProvider: libraryProvider,
    };

    const hover: Hover = await Utils.getHover(text, options);

    assert.isUndefined(hover.range);
    assert.isDefined(hover.contents);

    const contents: string = await expectHoverContents(hover);
    assert.isTrue(contents.startsWith("[unknown] "), `"${contents}.startsWith("[unknown] ") failed`);
    assert.isTrue(contents.endsWith(": unknown"), `"${contents}".endsWith(": unknown" failed`);
}

async function expectEmpty(text: string, analysisOptions?: AnalysisOptions): Promise<void> {
    const options: AnalysisOptions = analysisOptions ?? {
        librarySymbolProvider: libraryProvider,
    };

    const hover: Hover = await Utils.getHover(text, options);
    expect(hover).deep.equals(Utils.emptyHover);
}

describe("Hover", () => {
    describe(`WIP Local scope`, () => {
        describe(`ScopeItemKind text`, () => {
            it(`each`, async () => {
                await expectHover("each _|", "[each] _: unknown");
            });
            it(`key`, async () => {
                await expectHover("let foo = 1 in f|oo", "[key] foo: number");
            });
            it(`parameter`, async () => {
                await expectHover("let fn(foo as number) => fo|o in fn(1)", "[parameter] foo: number");
            });
        });
    });

    // it("Not an identifier", async () => expectEmpty('let a = "not iden|tifier" in a'));
    // it("Keyword hover", async () => expectEmpty('le|t a = "not identifier" in a'));
    // it("After identifier", async () => expectEmpty("let\r\nabc = Text.NewGuid()| in abc"));
    // it("No provider", async () => expectUnknownHover("let abc = Text.NewGu|id() in abc", {}));
    // it("Simple provider", async () => expectUnknownHover("let abc = Text.NewGu|id() in abc"));
    // it("Before .", async () => expectUnknownHover("let abc = Text|.NewGuid() in abc"));
    // it("After .", async () => expectUnknownHover("let abc = Text.|NewGuid() in abc"));
    // it("Two providers, one empty", async () =>
    //     expectHover("let abc = Text.|NewGuid() in abc", "Text.NewGuid", {
    //         librarySymbolProvider: libraryProvider,
    //         environmentSymbolProvider: EmptySymbolProvider,
    //     }));
    // it("Environment provider", async () =>
    //     expectHover("let abc = Text.|NewGuid() in abc", "Text.NewGuid", {
    //         environmentSymbolProvider: libraryProvider,
    //     }));
});

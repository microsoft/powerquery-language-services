// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { assert, expect } from "chai";
import "mocha";
import { MarkedString, MarkupContent } from "vscode-languageserver-types";

import * as Utils from "../utils";

import { AnalysisOptions, Hover } from "../../../powerquery-language-services";

const libraryProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider([
    "DateTime.FixedLocalNow",
    "DateTime.LocalNow",
    "Text.NewGuid",
]);

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

describe("Hover", () => {
    describe(`local scope`, () => {
        it(`each`, async () => {
            await expectHover("each _|", "[each] _: unknown");
        });
        it(`key`, async () => {
            await expectHover("let foo = 1 in f|oo", "[key] foo: number");
        });
        it(`parameter`, async () => {
            await expectHover("let fn = (foo as number) => fo|o in fn(1)", "[parameter] foo: number");
        });
        it(`section-member`, async () => {
            await expectHover("section green; eggs = 1; ham = e|ggs", `[section-member] eggs: number`);
        });
        it(`unknown`, async () => {
            await expectUnknownHover(`f|oo`);
        });
    });
});

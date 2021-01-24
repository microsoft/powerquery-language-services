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

async function expectHoverText(text: string, analysisOptions?: AnalysisOptions): Promise<string> {
    const options: AnalysisOptions = analysisOptions ?? {
        librarySymbolProvider: libraryProvider,
    };

    const hover: Hover = await Utils.getHover(text, options);

    assert.isUndefined(hover.range);
    assert.isDefined(hover.contents);

    const hoverContents: MarkupContent | MarkedString | MarkedString[] = hover.contents;

    if (typeof hoverContents === "string") {
        return hoverContents;
    } else if (MarkupContent.is(hoverContents) || MarkedString.is(hoverContents)) {
        return hoverContents.value;
    } else {
        throw new Error(`unknown hover kind`);
    }
}

async function expectHover(text: string, expected: string, analysisOptions?: AnalysisOptions): Promise<void> {
    const contents: string = await expectHoverText(text, analysisOptions);
    expect(contents).to.equal(expected);
}

async function expectUnknownHover(text: string, analysisOptions?: AnalysisOptions): Promise<void> {
    const contents: string = await expectHoverText(text, analysisOptions);
    assert.isTrue(contents.startsWith("[unknown] "), `"${contents}.startsWith("[unknown] ") failed`);
    assert.isTrue(contents.endsWith(": unknown"), `"${contents}".endsWith(": unknown" failed`);
}

async function expectEmptyHover(text: string, analysisOptions?: AnalysisOptions): Promise<void> {
    const hover: Hover = await Utils.getHover(text, analysisOptions);

    if (!Array.isArray(hover.contents)) {
        throw new Error(`expected an empty array`);
    }

    expect(hover.contents.length).to.equal(0);
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
        it(`unknown`, async () => {
            await expectUnknownHover(`f|oo`);
        });
    });

    describe(`hover should be empty on non-value identifiers`, async () => {
        it(`let f|oo = 1 in 1`, async () => {
            await expectEmptyHover(`let f|oo = 1 in 1`);
        });

        it(`[foo = 1, bar = 2][fo|o]`, async () => {
            await expectEmptyHover(`[foo = 1, bar = 2][fo|o]`);
        });

        it(`[foo = 1, bar = 2][[fo|o]]`, async () => {
            await expectEmptyHover(`[foo = 1, bar = 2][[fo|o]]`);
        });

        it(`let fn = (fo|o as number) => 1 in 1`, async () => {
            await expectEmptyHover(`let fn = (fo|o as number) => 1 in 1`);
        });
    });
});

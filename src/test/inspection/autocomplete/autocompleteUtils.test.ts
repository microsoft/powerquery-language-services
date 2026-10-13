// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { Autocomplete, AutocompleteItem, AutocompleteUtils } from "../../../powerquery-language-services/inspection";
import { TestUtils } from "../..";

describe("AutocompleteUtils.keys", () => {
    function item(label: string): AutocompleteItem {
        return { label, jaroWinklerScore: 1, powerQueryType: Type.AnyInstance };
    }

    function autocomplete(items: ReadonlyArray<AutocompleteItem>): Autocomplete {
        return {
            triedFieldAccess: ResultUtils.ok(undefined),
            triedKeyword: ResultUtils.ok(items),
            triedPrimitiveType: ResultUtils.ok([item("number")]),
            triedLanguageConstant: ResultUtils.ok([item("ignored")]),
        };
    }

    it("preserves field, keyword and primitive order, including duplicate labels", async () => {
        const inspected: Autocomplete = await TestUtils.expectAutocomplete("[first = 1, second = 2][|");

        expect(
            AutocompleteUtils.keys({
                ...inspected,
                triedKeyword: ResultUtils.ok([item("first"), item("let")]),
                triedPrimitiveType: ResultUtils.ok([item("number")]),
            }),
        ).to.deep.equal(["first", "second", "first", "let", "number"]);
    });

    it("preserves sparse slots", () => {
        const items: AutocompleteItem[] = new Array<AutocompleteItem>(3);
        items[1] = item("middle");

        const result: ReadonlyArray<string> = AutocompleteUtils.keys(autocomplete(items));

        expect(result.length).to.equal(4);
        expect(0 in result).to.equal(false);
        expect(1 in result).to.equal(true);
        expect(2 in result).to.equal(false);
        expect(result[1]).to.equal("middle");
        expect(result[3]).to.equal("number");
    });

    it("retains the initial group length when a label getter mutates its input", () => {
        const items: AutocompleteItem[] = [
            {
                get label(): string {
                    items.length = 1;

                    return "first";
                },
                jaroWinklerScore: 1,
                powerQueryType: Type.AnyInstance,
            },
            item("removed"),
        ];

        const result: ReadonlyArray<string> = AutocompleteUtils.keys(autocomplete(items));

        expect(result.length).to.equal(3);
        expect(result[0]).to.equal("first");
        expect(1 in result).to.equal(false);
        expect(result[2]).to.equal("number");
    });
});

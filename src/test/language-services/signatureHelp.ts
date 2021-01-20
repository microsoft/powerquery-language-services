// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { expect } from "chai";
import "mocha";
import { SignatureHelp } from "../../powerquery-language-services";

import * as Utils from "./utils";

// TODO: update simple library provider to support functions
// TODO: add more tests
describe("Signature Help (null provider))", () => {
    it("cursor on function", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Text.Gu|id()");
        expect(result).deep.equals(Utils.EmptySignatureHelp);
    });

    it("after open parens", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Text.FromNumber(|");
        expect(result).deep.equals(Utils.EmptySignatureHelp);
    });

    it("after parameter value", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Text.FromNumber(1|)");
        expect(result).deep.equals(Utils.EmptySignatureHelp);
    });

    it("after close parens", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Text.FromNumber(1)|");
        expect(result).deep.equals(Utils.EmptySignatureHelp);
    });

    it("on second parameter", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Date.AddDays(a,|)");
        expect(result).deep.equals(Utils.EmptySignatureHelp);
    });

    it("on second parameter (with space)", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Date.AddDays(a, |)");
        expect(result).deep.equals(Utils.EmptySignatureHelp);
    });
});

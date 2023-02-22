// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import { ActiveNodeUtils, TActiveNode } from "../../powerquery-language-services/inspection";
import { TestUtils } from "..";

describe(`ActiveNodeUtils`, () => {
    describe(`isInKey`, () => {
        it(`let |`, async () => {
            const text: string = `let |`;
            const activeNode: TActiveNode = Assert.asDefined(Assert.unboxOk(await TestUtils.createActiveNode(text)));

            ActiveNodeUtils.assertPositionInBounds(activeNode);
            expect(activeNode.isInKey).to.equal(true);
        });

        it(`let foo = |`, async () => {
            const text: string = `let foo = |`;
            const activeNode: TActiveNode = Assert.asDefined(Assert.unboxOk(await TestUtils.createActiveNode(text)));

            ActiveNodeUtils.assertPositionInBounds(activeNode);
            expect(activeNode.isInKey).to.equal(false);
        });

        it(`let foo = 1|`, async () => {
            const text: string = `let foo = 1|`;
            const activeNode: TActiveNode = Assert.asDefined(Assert.unboxOk(await TestUtils.createActiveNode(text)));

            ActiveNodeUtils.assertPositionInBounds(activeNode);
            expect(activeNode.isInKey).to.equal(false);
        });

        it(`let foo = 1,|`, async () => {
            const text: string = `let foo = 1,|`;
            const activeNode: TActiveNode = Assert.asDefined(Assert.unboxOk(await TestUtils.createActiveNode(text)));

            ActiveNodeUtils.assertPositionInBounds(activeNode);
            expect(activeNode.isInKey).to.equal(true);
        });

        it(`let foo = 1, |`, async () => {
            const text: string = `let foo = 1, |`;
            const activeNode: TActiveNode = Assert.asDefined(Assert.unboxOk(await TestUtils.createActiveNode(text)));

            ActiveNodeUtils.assertPositionInBounds(activeNode);
            expect(activeNode.isInKey).to.equal(true);
        });

        it(`let foo = 1, bar|`, async () => {
            const text: string = `let foo = 1, bar|`;
            const activeNode: TActiveNode = Assert.asDefined(Assert.unboxOk(await TestUtils.createActiveNode(text)));

            ActiveNodeUtils.assertPositionInBounds(activeNode);
            expect(activeNode.isInKey).to.equal(true);
        });
    });
});

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, DefaultSettings } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import { ActiveNodeUtils, TActiveNode } from "../../powerquery-language-services/inspection";
import { TestUtils } from "..";

describe(`ActiveNodeUtils`, () => {
    describe(`isInKey`, () => {
        async function runTest(textWithPipe: string, expected: boolean | undefined): Promise<void> {
            const activeNode: TActiveNode = await TestUtils.assertActiveNode(DefaultSettings, textWithPipe);

            if (expected !== undefined) {
                ActiveNodeUtils.assertPositionInBounds(activeNode);
                expect(activeNode.isInKey).to.equal(expected);
            }
        }

        it(`let |`, async () => await runTest(`let |`, true));

        it(`let k|`, async () => await runTest(`let k|`, true));

        it(`let |k`, async () => await runTest(`let |k`, true));

        it(`let k|=`, async () => await runTest(`let k|=`, true));

        it(`let k=|`, async () => await runTest(`let k=|`, false));

        it(`let k=1|`, async () => await runTest(`let k=1|`, false));

        it(`let k=1,|`, async () => await runTest(`let k=1,|`, true));

        it(`let k=1,|k`, async () => await runTest(`let k=1,|k`, true));

        it(`let k=1,k|`, async () => await runTest(`let k=1,k|`, true));

        it(`let k=1, k|`, async () => await runTest(`let k=1, k|`, true));

        it(`let k=1, k|=`, async () => await runTest(`let k=1, k|=`, true));
    });
});

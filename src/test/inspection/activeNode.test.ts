// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, expect, it } from "bun:test";
import { DefaultSettings } from "@microsoft/powerquery-parser";

import { ActiveNodeUtils, type TActiveNode } from "../../powerquery-language-services/inspection";
import { TestUtils } from "..";

describe(`ActiveNodeUtils`, () => {
    describe(`isInKey`, () => {
        async function runTest(params: {
            readonly textWithPipe: string;
            readonly expected: boolean | undefined;
        }): Promise<void> {
            const activeNode: TActiveNode = await TestUtils.assertActiveNode({
                textWithPipe: params.textWithPipe,
                settings: DefaultSettings,
            });

            if (params.expected !== undefined) {
                ActiveNodeUtils.assertPositionInBounds(activeNode);
                expect(activeNode.isInKey).toEqual(params.expected);
            }
        }

        it(`let |`, async () =>
            await runTest({
                textWithPipe: `let |`,
                expected: true,
            }));

        it(`let k|`, async () =>
            await runTest({
                textWithPipe: `let k|`,
                expected: true,
            }));

        it(`let |k`, async () =>
            await runTest({
                textWithPipe: `let |k`,
                expected: true,
            }));

        it(`let k|=`, async () =>
            await runTest({
                textWithPipe: `let k|=`,
                expected: true,
            }));

        it(`let k=|`, async () =>
            await runTest({
                textWithPipe: `let k=|`,
                expected: false,
            }));

        it(`let k=1|`, async () =>
            await runTest({
                textWithPipe: `let k=1|`,
                expected: false,
            }));

        it(`let k=1,|`, async () =>
            await runTest({
                textWithPipe: `let k=1,|`,
                expected: true,
            }));

        it(`let k=1,|k`, async () =>
            await runTest({
                textWithPipe: `let k=1,|k`,
                expected: true,
            }));

        it(`let k=1,k|`, async () =>
            await runTest({
                textWithPipe: `let k=1,k|`,
                expected: true,
            }));

        it(`let k=1, k|`, async () =>
            await runTest({
                textWithPipe: `let k=1, k|`,
                expected: true,
            }));

        it(`let k=1, k|=`, async () =>
            await runTest({
                textWithPipe: `let k=1, k|=`,
                expected: true,
            }));
    });
});

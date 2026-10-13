// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import {
    calculateJaroWinkler,
    calculateJaroWinklers,
    calculateJaroWinklersWithPreparedOptions,
    findJaroWinklerSuggestionWithBaseline,
    JaroWinklerScoreCache,
    prepareJaroWinklerOptions,
} from "../../powerquery-language-services/jaroWinkler";

describe(`Jaro-Winkler`, () => {
    it(`case insensitive`, () => {
        const key: string = "Table.AddColumn";
        expect(calculateJaroWinkler(key, key.toUpperCase())).to.equal(calculateJaroWinkler(key, key.toLowerCase()));
    });

    it(`one character off`, () => {
        const left: string = "Table.AddColumn";
        const right: string = "Tabl.AddColumn";
        expect(calculateJaroWinkler(left, right)).to.equal(0.9866666666666667);
    });

    it(`many characters off`, () => {
        const left: string = "Table.AddColumn";
        const right: string = "Tbl.AsdC";
        expect(calculateJaroWinkler(left, right)).to.equal(0.5900793650793651);
    });

    it(`prepared options preserve scores and original spelling`, () => {
        const source: string = "tabl.addcolumn";
        const options: ReadonlyArray<string> = ["Table.RemoveColumns", "Table.AddColumn", "TABLE.ADDCOLUMN"];

        expect(calculateJaroWinklersWithPreparedOptions(source, prepareJaroWinklerOptions(options))).to.deep.equal(
            calculateJaroWinklers(source, options),
        );
    });

    it(`bulk comparison sizes buffers from normalized text`, () => {
        const source: string = "ix";
        const option: string = "\u0130x";

        expect(calculateJaroWinklers(source, [option])).to.deep.equal([calculateJaroWinkler(source, option), option]);
    });

    it(`pruned suggestion search preserves local-first ordering`, () => {
        const source: string = "table.addcolumn";
        const localOptions: ReadonlyArray<string> = ["TABLE.ADDCOLUMN", "unrelated"];
        const libraryOptions: ReadonlyArray<string> = ["Table.AddColumn", "Table.RemoveColumns"];
        const libraryResult: [number, string] = calculateJaroWinklers(source, libraryOptions);
        const expected: [number, string] = calculateJaroWinklers(source, [...localOptions, ...libraryOptions]);

        expect(findJaroWinklerSuggestionWithBaseline(source, localOptions, new Map(), libraryResult, 0.9)).to.equal(
            expected[0] > 0.9 ? expected[1] : undefined,
        );
    });

    it(`pruned suggestion search matches exhaustive short-string scoring`, () => {
        const values: string[] = [""];

        for (let length: number = 1; length <= 4; length += 1) {
            for (let bits: number = 0; bits < 2 ** length; bits += 1) {
                let value: string = "";

                for (let index: number = 0; index < length; index += 1) {
                    value += bits & (1 << index) ? "a" : "b";
                }

                values.push(value);
            }
        }

        const localOptions: ReadonlyArray<string> = values.filter((_: string, index: number) => index % 2 === 0);
        const libraryOptions: ReadonlyArray<string> = values.filter((_: string, index: number) => index % 2 === 1);

        for (const source of values) {
            const libraryResult: [number, string] = calculateJaroWinklers(source, libraryOptions);
            const expected: [number, string] = calculateJaroWinklers(source, [...localOptions, ...libraryOptions]);

            expect(findJaroWinklerSuggestionWithBaseline(source, localOptions, new Map(), libraryResult, 0.9)).to.equal(
                expected[0] > 0.9 ? expected[1] : undefined,
            );
        }
    });

    it("preserves exhaustive selection at floating-point tie and threshold boundaries", () => {
        for (let sourceLength: number = 1; sourceLength <= 20; sourceLength += 1) {
            const source: string = "a".repeat(sourceLength);

            for (let optionLength: number = sourceLength + 1; optionLength <= 200; optionLength += 1) {
                const local: string = "A".repeat(optionLength);
                const library: string = "a".repeat(optionLength);
                const baseline: [number, string] = calculateJaroWinklers(source, [library]);
                const exhaustive: [number, string] = calculateJaroWinklers(source, [local, library]);
                const cache: JaroWinklerScoreCache = new JaroWinklerScoreCache();

                for (const threshold of [0.9, exhaustive[0], exhaustive[0] - Number.EPSILON]) {
                    const expected: string | undefined = exhaustive[0] > threshold ? exhaustive[1] : undefined;

                    for (const scoreCache of [undefined, cache]) {
                        expect(
                            findJaroWinklerSuggestionWithBaseline(
                                source,
                                [local],
                                new Map(),
                                baseline,
                                threshold,
                                scoreCache,
                            ),
                            `source length ${sourceLength}, option length ${optionLength}, threshold ${threshold}`,
                        ).to.equal(expected);
                    }
                }
            }
        }
    });

    it("normalizes identifiers and reuses cached values", () => {
        const normalizedByValue: Map<string, string> = new Map();

        for (const reuse of [false, true]) {
            if (reuse) {
                normalizedByValue.set = (): never => {
                    throw new Error("Unexpected normalization recomputation");
                };
            }

            for (const option of ["Table.AddColumn", ""]) {
                const source: string = option.slice(0, -1);
                const expected: [number, string] = calculateJaroWinklers(source, [option]);

                expect(
                    findJaroWinklerSuggestionWithBaseline(source, [option], normalizedByValue, [0, ""], 0.9),
                ).to.equal(expected[0] > 0.9 ? expected[1] : undefined);

                expect(normalizedByValue.get(source)).to.equal(source.toLowerCase());
                expect(normalizedByValue.get(option)).to.equal(option.toLowerCase());
            }
        }
    });

    describe(`bounded score cache`, () => {
        it(`reuses normalized pairs across scopes without retaining spelling or tie order`, () => {
            const cache: JaroWinklerScoreCache = new JaroWinklerScoreCache();
            const normalizedByValue: Map<string, string> = new Map();
            const baseline: [number, string] = [1, "Table.AddColumn"];
            const firstScope: Map<string, undefined> = new Map([["TABLE.ADDCOLUMN", undefined]]);

            const secondScope: Map<string, undefined> = new Map([
                ["table.addcolumn", undefined],
                ["TABLE.ADDCOLUMN", undefined],
            ]);

            expect(
                findJaroWinklerSuggestionWithBaseline(
                    "Table.AddColumn",
                    firstScope.keys(),
                    normalizedByValue,
                    baseline,
                    0.9,
                    cache,
                ),
            ).to.equal("TABLE.ADDCOLUMN");

            expect(cache.get("table.addcolumn", "table.addcolumn")).to.equal(1);

            // A cache hit must not publish the score a second time.
            cache.set = (): never => {
                throw new Error("Unexpected score recomputation");
            };

            expect(
                findJaroWinklerSuggestionWithBaseline(
                    "TABLE.ADDCOLUMN",
                    secondScope.keys(),
                    normalizedByValue,
                    baseline,
                    0.9,
                    cache,
                ),
            ).to.equal("table.addcolumn");
        });

        it(`does not cache pruned bounds when a later scope uses a lower baseline or threshold`, () => {
            const source: string = "abcd";
            const option: string = "ab";
            const cache: JaroWinklerScoreCache = new JaroWinklerScoreCache();

            for (const [baseline, threshold] of [
                [[1, "library"], 0.9],
                [[-1, ""], 1],
            ] as ReadonlyArray<[[number, string], number]>) {
                findJaroWinklerSuggestionWithBaseline(source, [option], new Map(), baseline, threshold, cache);

                expect(cache.get(source, option)).to.equal(undefined);
            }

            expect(findJaroWinklerSuggestionWithBaseline(source, [option], new Map(), [-1, ""], 0, cache)).to.equal(
                option,
            );

            expect(cache.get(source, option)).to.equal(calculateJaroWinkler(source, option));
        });

        it(`reuses zero scores and applies the threshold strictly`, () => {
            const cache: JaroWinklerScoreCache = new JaroWinklerScoreCache();

            expect(findJaroWinklerSuggestionWithBaseline("aa", ["bb"], new Map(), [-1, ""], -1, cache)).to.equal("bb");

            expect(cache.get("aa", "bb")).to.equal(0);

            cache.set = (): never => {
                throw new Error("Unexpected zero-score recomputation");
            };

            expect(findJaroWinklerSuggestionWithBaseline("AA", ["BB"], new Map(), [-1, ""], 0, cache)).to.equal(
                undefined,
            );

            expect(findJaroWinklerSuggestionWithBaseline("AA", ["BB"], new Map(), [-1, ""], -1, cache)).to.equal("BB");
        });

        it(`clears all pairs at capacity and counts distinct pairs rather than writes`, () => {
            const cache: JaroWinklerScoreCache = new JaroWinklerScoreCache();

            for (let index: number = 0; index < 8192; index += 1) {
                cache.set("first", "option1", 0);
            }

            for (let index: number = 0; index < 8192; index += 1) {
                cache.set(index % 2 ? "first" : "second", `option${index}`, 1);
            }

            for (let index: number = 0; index < 8192; index += 1) {
                expect(cache.get(index % 2 ? "first" : "second", `option${index}`)).to.equal(1);
            }

            cache.set("third", "new", 0);

            for (let index: number = 0; index < 8192; index += 1) {
                expect(cache.get(index % 2 ? "first" : "second", `option${index}`)).to.equal(undefined);
            }

            expect(cache.get("third", "new")).to.equal(0);
        });

        it(`matches uncached scoring across Unicode, long prefixes, orders and thresholds`, () => {
            const cache: JaroWinklerScoreCache = new JaroWinklerScoreCache();

            const values: ReadonlyArray<string> = [
                "",
                "a",
                "A",
                "b",
                "aa",
                "ab",
                "ba",
                "bb",
                "Table.AddColumn",
                "TABLE.ADDCOLUMN",
                "Table.AddColum",
                "abcdefghijklmnop",
                "abcdefghijklmnoz",
                "\u0130x",
                "ix",
                "a\0b",
            ];

            const baselines: ReadonlyArray<[number, string]> = [
                [-1, ""],
                [0.9, "library"],
                [1, "LIBRARY"],
                [1.2, "other"],
            ];

            for (let round: number = 0; round < 4; round += 1) {
                const options: ReadonlyArray<string> = round % 2 ? [...values].reverse() : values;

                for (const source of values) {
                    for (const threshold of [0, 0.7, 0.9, 1, 1.5]) {
                        for (const baseline of baselines) {
                            const expected: string | undefined = findJaroWinklerSuggestionWithBaseline(
                                source,
                                options,
                                new Map(),
                                baseline,
                                threshold,
                            );

                            expect(
                                findJaroWinklerSuggestionWithBaseline(
                                    source,
                                    options,
                                    new Map(),
                                    baseline,
                                    threshold,
                                    cache,
                                ),
                            ).to.equal(expected);
                        }
                    }
                }
            }
        });
    });
});

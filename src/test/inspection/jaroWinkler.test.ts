// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import {
    calculateJaroWinkler,
    calculateJaroWinklers,
    calculateJaroWinklersWithPreparedOptions,
    findJaroWinklerSuggestionWithBaseline,
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

        expect(
            findJaroWinklerSuggestionWithBaseline(source, localOptions, Object.create(null), libraryResult, 0.9),
        ).to.equal(expected[0] > 0.9 ? expected[1] : undefined);
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

            expect(
                findJaroWinklerSuggestionWithBaseline(source, localOptions, Object.create(null), libraryResult, 0.9),
            ).to.equal(expected[0] > 0.9 ? expected[1] : undefined);
        }
    });
});

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import {
    calculateJaroWinkler,
    calculateJaroWinklers,
    calculateJaroWinklersWithPreparedOptions,
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
});

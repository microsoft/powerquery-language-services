// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { calculateJaroWinkler } from "../../powerquery-language-services/jaroWinkler";

describe(`WIP Jaro-Winkler`, () => {
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
});

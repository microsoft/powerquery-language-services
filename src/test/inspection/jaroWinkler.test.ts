// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, expect, it } from "bun:test";

import { calculateJaroWinkler } from "../../powerquery-language-services/jaroWinkler";

describe(`Jaro-Winkler`, () => {
    it(`case insensitive`, () => {
        const key: string = "Table.AddColumn";
        expect(calculateJaroWinkler(key, key.toUpperCase())).toBe(calculateJaroWinkler(key, key.toLowerCase()));
    });

    it(`one character off`, () => {
        const left: string = "Table.AddColumn";
        const right: string = "Tabl.AddColumn";
        expect(calculateJaroWinkler(left, right)).toBe(0.9866666666666667);
    });

    it(`many characters off`, () => {
        const left: string = "Table.AddColumn";
        const right: string = "Tbl.AsdC";
        expect(calculateJaroWinkler(left, right)).toBe(0.5900793650793651);
    });
});

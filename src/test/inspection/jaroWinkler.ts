// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";

import { calculateJaroWinkler } from "../../powerquery-language-services/inspection";

describe(`Jaro-Winkler`, () => {
    it(`case insensitive`, () => {
        const key: string = "Table.AddColumn";
        expect(calculateJaroWinkler(key, key.toUpperCase())).to.equal(calculateJaroWinkler(key, key.toLowerCase()));
    });
});

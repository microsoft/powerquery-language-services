// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Mocha = require("mocha");

class MultiReporter {
    constructor(runner: Mocha.Runner, options: Mocha.MochaOptions) {
        new Mocha.reporters.Spec(runner, options);
        new Mocha.reporters.XUnit(runner, options);
    }
}

export = MultiReporter;

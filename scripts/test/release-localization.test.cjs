"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { LOCALIZATION_CACHE_SMOKE } = require("../release-consumer.cjs");

for (const name of ["@microsoft/powerquery-parser", "@microsoft/powerquery-formatter",
    "@microsoft/powerquery-language-services"]) {
    test(`${name} loads only the selected locale and caches its templates`, () => {
        const child = spawnSync(process.execPath, ["-e", LOCALIZATION_CACHE_SMOKE, name], {
            cwd: path.resolve(__dirname, "..", ".."),
            encoding: "utf8",
        });
        assert.equal(child.status, 0, child.stderr);
        const result = JSON.parse(child.stdout);
        assert.equal(result.coldNonEnglish, 0);
        assert.equal(result.afterFirstUseNonEnglish, 1);
    });
}

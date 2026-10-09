// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const path = require("node:path");
const { registerHooks } = require("node:module");

module.exports = function registerLocalParser(parserRoot) {
    const packageName = "@microsoft/powerquery-parser";
    const redirected = new Set();
    registerHooks({
        resolve(specifier, context, nextResolve) {
            if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
                const target =
                    specifier === packageName
                        ? path.join(parserRoot, "lib", "powerquery-parser", "index.js")
                        : path.join(parserRoot, ...specifier.slice(packageName.length + 1).split("/"));
                redirected.add(specifier);
                return nextResolve(require.resolve(target), context);
            }
            return nextResolve(specifier, context);
        },
    });
    return redirected;
};

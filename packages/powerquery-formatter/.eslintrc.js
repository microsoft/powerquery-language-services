const shared = require("../../eslint.legacy.cjs");

module.exports = {
    ...shared,
    parserOptions: { ...shared.parserOptions, tsconfigRootDir: __dirname },
};

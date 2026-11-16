require("ts-node/register");
module.exports = require("../../eslint.shared.ts")(__dirname, [
    "src/**/*.ts",
    "test/**/*.ts",
    "benchmark/**/*.ts",
    "scripts/**/*.ts",
    "*.ts",
]);

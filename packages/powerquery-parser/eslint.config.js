require("ts-node/register");
module.exports = require("../../eslint.shared.ts")(__dirname, ["src/**/*.ts", "test/**/*.ts", "*.ts"], {
    console: "readonly",
});

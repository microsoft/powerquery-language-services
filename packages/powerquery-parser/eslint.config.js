module.exports = require("../../eslint.shared.cjs")(
    __dirname,
    ["src/**/*.ts", "test/**/*.ts", "*.ts"],
    { console: "readonly" },
);

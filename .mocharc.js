require("ts-node").register({ project: require.resolve("./scripts/tsconfig.json") });
module.exports = require("./mocha.shared.ts").default;

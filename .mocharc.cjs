module.exports = {
    require: ["ts-node/register"],
    extensions: ["ts"],
    reporter: require.resolve("./scripts/mochaReporter.cjs"),
    "reporter-option": ["output=test-results.xml"],
};

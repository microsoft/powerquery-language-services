module.exports = {
    ...require("../../.mocharc.cjs"),
    spec: "test/resourceTest/**/*.ts",
    "reporter-option": ["output=test-results-resources.xml"],
};

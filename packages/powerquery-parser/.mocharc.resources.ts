import sharedConfig, { MochaConfig } from "../../mocha.shared";

const config: MochaConfig = {
    ...sharedConfig,
    spec: "test/resourceTest/**/*.ts",
    "reporter-option": ["output=test-results-resources.xml"],
};

export default config;

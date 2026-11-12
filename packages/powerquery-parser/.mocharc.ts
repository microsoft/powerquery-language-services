import sharedConfig, { MochaConfig } from "../../mocha.shared";

const config: MochaConfig = {
    ...sharedConfig,
    spec: "test/libraryTest/**/*.ts",
};

export default config;

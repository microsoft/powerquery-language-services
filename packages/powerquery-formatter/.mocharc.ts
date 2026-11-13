import sharedConfig, { MochaConfig } from "../../mocha.shared";

const config: MochaConfig = {
    ...sharedConfig,
    spec: "test/**/*.ts",
};

export default config;

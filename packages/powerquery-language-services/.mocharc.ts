import sharedConfig, { MochaConfig } from "../../mocha.shared";

const config: MochaConfig = {
    ...sharedConfig,
    spec: "test/**/*.test.ts",
};

export default config;

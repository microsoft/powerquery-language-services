import type { MochaOptions } from "mocha";

export interface MochaConfig extends MochaOptions {
    extensions: string[];
    spec?: string;
    "reporter-option": string[];
}

const config: MochaConfig = {
    extensions: ["ts"],
    reporter: require.resolve("./scripts/mochaReporter.ts"),
    "reporter-option": ["output=test-results.xml"],
};

export default config;

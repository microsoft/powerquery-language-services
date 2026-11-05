const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packages = ["powerquery-parser", "powerquery-formatter", "powerquery-language-services"];
const reports = [
    "powerquery-parser/test-results.xml",
    "powerquery-parser/test-results-resources.xml",
    "powerquery-formatter/test-results.xml",
    "powerquery-language-services/test-results.xml",
];

function main() {
    const [command, selected] = process.argv.slice(2);
    if (selected && !packages.includes(selected)) {
        throw new Error(`Unknown package: ${selected}`);
    }
    if (command === "clean") {
        for (const name of selected ? [selected] : packages) {
            const directory = path.join(root, "packages", name);
            fs.rmSync(path.join(directory, "lib"), { recursive: true, force: true });
            fs.rmSync(path.join(directory, "tsconfig.tsbuildinfo"), { force: true });
        }
        for (const report of reports) {
            if (!selected || report.startsWith(`${selected}/`)) {
                fs.rmSync(path.join(root, "packages", report), { force: true });
            }
        }
    } else if (command === "reports" && !selected) {
        for (const report of reports) {
            const contents = fs.readFileSync(path.join(root, "packages", report), "utf8");
            if (!contents.includes("<testsuite") || !/\btests="[1-9]\d*"/.test(contents)) {
                throw new Error(`Missing or empty test suite: ${report}`);
            }
            if (/\b(?:failures|errors)="[1-9]\d*"/.test(contents)) {
                throw new Error(`Failed test suite: ${report}`);
            }
        }
        console.log("All four expected JUnit suites are present and successful.");
    } else {
        throw new Error("Usage: node scripts/workspace.cjs clean [package] | reports");
    }
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}

import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "..");
const packages = ["powerquery-parser", "powerquery-formatter", "powerquery-language-services"];

function main(): void {
    const [command, selected] = process.argv.slice(2);
    if (selected && !packages.includes(selected)) {
        throw new Error(`Unknown package: ${selected}`);
    }
    if (command === "clean") {
        for (const name of selected ? [selected] : packages) {
            const directory = path.join(root, "packages", name);
            fs.rmSync(path.join(directory, "lib"), { recursive: true, force: true });
            fs.rmSync(path.join(directory, "tsconfig.tsbuildinfo"), { force: true });
            for (const file of fs.readdirSync(directory)) {
                if (/^test-results.*\.xml$/.test(file)) {
                    fs.rmSync(path.join(directory, file), { force: true });
                }
            }
        }
    } else {
        throw new Error("Usage: ts-node scripts/workspace.ts clean [package]");
    }
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}

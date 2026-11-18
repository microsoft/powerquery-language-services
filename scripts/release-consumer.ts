import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PACKAGES, check, readJson, writeJson, run, npm, PackageMetadata } from "./release";
import { inside, verifyManifest, ReleaseManifest } from "./release-artifacts";

export const SMOKE = `
import * as parser from "@microsoft/powerquery-parser";
import * as formatter from "@microsoft/powerquery-formatter";
import * as services from "@microsoft/powerquery-language-services";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TaskUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/task";
import { tryFormat } from "@microsoft/powerquery-formatter/lib/powerquery-formatter/format";
import { AnalysisUtils } from "@microsoft/powerquery-language-services/lib/powerquery-language-services/analysis";
import * as parserTemplates from "@microsoft/powerquery-parser/lib/powerquery-parser/localization/templates";
import * as serviceTemplates from "@microsoft/powerquery-language-services/lib/powerquery-language-services/localization/templates";

function expect(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}
async function main(): Promise<void> {
    const source = "let x=1 in x";
    const parsed = await TaskUtils.tryLexParse(parser.DefaultSettings, source);
    TaskUtils.assertIsParseStageOk(parsed);
    expect(Type.TypeKind.Number !== undefined, "Parser deep import failed");
    expect(parserTemplates.fr_FR && serviceTemplates.fr_FR, "Localized runtime imports failed");
    const formatted = await tryFormat(formatter.DefaultSettings, source);
    expect(parser.ResultUtils.isOk(formatted) && formatted.value.includes("let"), "Formatter smoke failed");
    const document = services.textDocument("file:///release-smoke.pq", 1, source);
    const edits = await services.tryFormat(document, formatter.DefaultSettings);
    expect(parser.ResultUtils.isOk(edits) && edits.value?.length === 1, "Services formatting smoke failed");
    const analysis = AnalysisUtils.analysis(document, {
        inspectionSettings: services.InspectionUtils.inspectionSettings(parser.DefaultSettings),
        isWorkspaceCacheAllowed: false,
        initialCorrelationId: undefined,
        traceManager: parser.DefaultSettings.traceManager,
    });
    try {
        const state = await analysis.getParseState();
        expect(parser.ResultUtils.isOk(state) && state.value, "Services analysis smoke failed");
        const symbols = await analysis.getDocumentSymbols();
        expect(parser.ResultUtils.isOk(symbols) && Array.isArray(symbols.value), "Services symbols smoke failed");
    } finally {
        analysis.dispose();
    }
}
void main();
`;

export function cleanEnvironment(): NodeJS.ProcessEnv {
    const env = Object.fromEntries(
        Object.entries(process.env)
            .filter(([key]) => !/^(?:node_path$|node_options$|npm_lifecycle_|npm_package_)/i.test(key))
            .map(([key, value]) => [/^npm_config_/i.test(key) ? key.toUpperCase() : key, value]),
    );
    return {
        ...env,
        NODE_PATH: "",
        NODE_OPTIONS: "",
        NPM_CONFIG_AUDIT: "false",
        NPM_CONFIG_FUND: "false",
    };
}

export async function validateConsumer(root: string, manifest: ReleaseManifest): Promise<void> {
    const dist = path.join(root, "dist");
    await verifyManifest(manifest, dist, root);
    const compiler = path.join(root, "node_modules", "typescript", "bin", "tsc");
    check(fs.existsSync(compiler), "Root TypeScript compiler is missing; install root dependencies first");
    // Use a separate home-based directory, never the workspace or its node_modules.
    const base = path.join(os.homedir(), ".powerquery-release-consumers");
    fs.mkdirSync(base, { recursive: true });
    const consumer = fs.mkdtempSync(path.join(base, "consumer-"));
    try {
        const realConsumer = fs.realpathSync(consumer);
        const realRoot = fs.realpathSync(root);
        check(
            !realConsumer.startsWith(`${realRoot}${path.sep}`) && realConsumer !== realRoot,
            "Consumer must be outside the release workspace",
        );
        writeJson(path.join(consumer, "package.json"), {
            name: "powerquery-release-consumer",
            version: "1.0.0",
            private: true,
        });
        const env = cleanEnvironment();
        env.NPM_CONFIG_USERCONFIG = npm(["config", "get", "userconfig"]);
        env.NPM_CONFIG_GLOBALCONFIG = npm(["config", "get", "globalconfig"]);
        npm(
            [
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--workspaces=false",
                "--prefer-online",
                "--fetch-retries=0",
                "--fetch-timeout=30000",
                ...manifest.packages.map(item => inside(dist, item.tarball)),
            ],
            { cwd: consumer, env },
        );
        for (const entry of PACKAGES) {
            const installed = path.join(consumer, "node_modules", entry.name);
            check(!fs.lstatSync(installed).isSymbolicLink(), `${entry.name} consumer resolved to a workspace link`);
            check(
                readJson<PackageMetadata>(path.join(installed, "package.json")).version === manifest.releaseVersion,
                `${entry.name} consumer installed the wrong release`,
            );
        }
        run(
            process.execPath,
            [
                "-e",
                `
            const fs = require("node:fs"), path = require("node:path");
            const names = ${JSON.stringify(PACKAGES.map(entry => entry.name))};
            for (const name of names) {
                const expected = fs.realpathSync(require.resolve(name + "/package.json"));
                for (const parent of names) {
                    const resolve = require("node:module").createRequire(require.resolve(parent));
                    if (fs.realpathSync(resolve.resolve(name + "/package.json")) !== expected)
                        throw new Error(parent + " did not resolve the installed " + name + " tarball");
                }
            }
        `,
            ],
            { cwd: consumer, env },
        );
        fs.writeFileSync(path.join(consumer, "smoke.ts"), SMOKE);
        writeJson(path.join(consumer, "tsconfig.json"), {
            compilerOptions: {
                target: "ES2022",
                module: "node16",
                moduleResolution: "node16",
                strict: true,
                skipLibCheck: false,
                noEmitOnError: true,
                types: [],
                resolveJsonModule: true,
                esModuleInterop: true,
            },
            files: ["smoke.ts"],
        });
        run(process.execPath, [compiler, "--project", path.join(consumer, "tsconfig.json")], { cwd: consumer, env });
        run(process.execPath, ["--unhandled-rejections=strict", path.join(consumer, "smoke.js")], {
            cwd: consumer,
            env,
        });
    } finally {
        fs.rmSync(consumer, { recursive: true, force: true });
        if (fs.readdirSync(base).length === 0) fs.rmdirSync(base);
    }
}

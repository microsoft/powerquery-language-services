const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const [slug, mode] = process.argv.slice(2);
const packages = require("../package.json").workspaces.map((workspace) => path.basename(workspace));
if (!packages.includes(slug)) throw new Error(`Unknown package: ${slug}`);
if (mode !== undefined && mode !== "--watch") throw new Error(`Unknown build mode: ${mode}`);
const workspace = path.join(root, "packages", slug);
const lib = path.join(workspace, "lib");
const sourceOutput = path.join(lib, "src");
const publishedOutput = path.join(lib, slug);
function publishedPath(file) {
    return file === sourceOutput || file.startsWith(sourceOutput + path.sep)
        ? path.join(publishedOutput, path.relative(sourceOutput, file)) : file;
}
function rebase(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, item.name);
        if (item.isDirectory()) {
            rebase(file);
        } else if (file.endsWith(".js") || file.endsWith(".d.ts")) {
            const content = fs.readFileSync(file, "utf8");
            const updated = content.replace(/((?:from\s*|import\s*|require\s*\(\s*|import\s*\(\s*)["'])(\.[^"']+)(["'])/g,
                (match, before, specifier, after) => {
                    const target = publishedPath(path.resolve(path.dirname(file), specifier));
                    let relative = path.relative(path.dirname(publishedPath(file)), target).split(path.sep).join("/");
                    if (!relative.startsWith(".")) relative = "./" + relative;
                    return before + relative + after;
                });
            if (updated !== content) fs.writeFileSync(file, updated);
        }
    }
}
function publishOutput() {
    if (fs.existsSync(lib)) rebase(lib);
    if (fs.existsSync(sourceOutput)) {
        fs.cpSync(sourceOutput, publishedOutput, { recursive: true });
        fs.rmSync(sourceOutput, { recursive: true });
    }
}
if (mode === "--watch") {
    const ts = require("typescript");
    const host = ts.createWatchCompilerHost(path.join(workspace, "tsconfig.json"), {}, ts.sys);
    const afterProgramCreate = host.afterProgramCreate;
    host.afterProgramCreate = (builder) => {
        afterProgramCreate(builder);
        if (ts.getPreEmitDiagnostics(builder.getProgram()).length === 0) publishOutput();
    };
    ts.createWatchProgram(host);
} else {
    const result = spawnSync(process.execPath, [
        path.join(root, "node_modules", "typescript", "bin", "tsc"), "--project", path.join(workspace, "tsconfig.json"),
    ], { cwd: workspace, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
    publishOutput();
}

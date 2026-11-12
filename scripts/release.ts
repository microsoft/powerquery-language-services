import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import * as semver from "semver";

export interface PackageEntry {
    slug: string;
    name: string;
    workspace: string;
    main: string;
    types: string;
    dependencies: string[];
}

export interface RootMetadata {
    name: string;
    version: string;
    private: boolean;
    workspaces: string[];
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    engines?: Record<string, string>;
}

export interface PackageMetadata {
    [key: string]: unknown;
    name: string;
    version: string;
    private?: boolean;
    main: string;
    types: string;
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    engines?: Record<string, string>;
    scripts?: Record<string, string>;
    publishConfig: { access: string; tag: string; [key: string]: unknown };
}

export interface LockEntry {
    name?: string;
    version?: string;
    resolved?: string;
    link?: boolean;
    workspaces?: string[];
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    engines?: Record<string, string>;
}

export interface PackageLock {
    name: string;
    version: string;
    lockfileVersion: number;
    packages: Record<string, LockEntry>;
}

export interface RunOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
    inherit?: boolean;
}

export type Execute = (args: string[], options: RunOptions & { cwd: string }) => unknown;

export interface PreparationOptions {
    root?: string;
    execute?: Execute;
    now?: () => Date;
    resolution?: boolean;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export const ROOT = path.resolve(__dirname, "..");
export const PACKAGES: readonly PackageEntry[] = Object.freeze(
    ["powerquery-parser", "powerquery-formatter", "powerquery-language-services"].map((slug, index, slugs) => ({
        slug,
        name: `@microsoft/${slug}`,
        workspace: `packages/${slug}`,
        main: `lib/${slug}/index.js`,
        types: `lib/${slug}/index.d.ts`,
        dependencies: slugs.slice(0, index).map(dependency => `@microsoft/${dependency}`),
    })),
);

export function check(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

export function readJson<T = unknown>(filename: string): T {
    try {
        return JSON.parse(fs.readFileSync(filename, "utf8"));
    } catch (error) {
        throw new Error(`Cannot read JSON ${filename}: ${errorMessage(error)}`, { cause: error });
    }
}

export function writeJson(filename: string, value: unknown): void {
    fs.writeFileSync(filename, `${JSON.stringify(value, null, 4)}\n`);
}

export function versionTag(version: unknown): "latest" | "next" {
    check(
        typeof version === "string" &&
            version.trim() === version &&
            /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version) &&
            semver.valid(version) !== null,
        `Expected a strict full SemVer without a leading v: ${String(version)}`,
    );
    return semver.prerelease(version) === null ? "latest" : "next";
}

export function same(actual: unknown, expected: unknown, message: string): void {
    const sort = (value: unknown): unknown =>
        Array.isArray(value)
            ? value.map(sort)
            : value !== null && typeof value === "object"
              ? Object.fromEntries(
                    Object.entries(value)
                        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
                        .map(([key, item]) => [key, sort(item)]),
                )
              : value;
    const canonical = (value: unknown): string | undefined => JSON.stringify(sort(value));
    check(canonical(actual) === canonical(expected), message);
}

export function internalDependencies(metadata: PackageMetadata): Record<string, string> {
    return Object.fromEntries(
        Object.entries(metadata.dependencies ?? {}).filter(([name]) => PACKAGES.some(entry => entry.name === name)),
    );
}

export function validatePackage(
    metadata: PackageMetadata,
    entry: PackageEntry,
    versions: Record<string, string>,
): void {
    const version = versions[entry.name];
    check(metadata.name === entry.name, `Unexpected package name in ${entry.workspace}`);
    check(metadata.private === undefined || metadata.private === false, `${entry.name} must be public`);
    check(
        metadata.main === entry.main && metadata.types === entry.types,
        `${entry.name} must expose ${entry.main} and ${entry.types}`,
    );
    check(metadata.version === version, `${entry.name} must have release version ${version}`);
    const tag = versionTag(version);
    check(
        metadata.publishConfig?.access === "public" && metadata.publishConfig?.tag === tag,
        `${entry.name} publishConfig must specify access public and tag ${tag}`,
    );
    check(
        Object.keys(metadata.publishConfig).every(key => ["access", "tag"].includes(key)),
        `${entry.name} contains private or unexpected publish settings`,
    );
    same(
        internalDependencies(metadata),
        Object.fromEntries(entry.dependencies.map(name => [name, versions[name]])),
        `${entry.name} must have the exact complete internal dependency closure at referenced package versions`,
    );
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
        for (const name of Object.keys(metadata[section] ?? {})) {
            if (name.startsWith("@microsoft/powerquery-")) {
                check(
                    section === "dependencies" && entry.dependencies.includes(name),
                    `${entry.name} has an unexpected internal dependency in ${section}: ${name}`,
                );
            }
        }
        for (const section of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
            for (const [name, value] of Object.entries(metadata[section] ?? {})) {
                check(
                    typeof value === "string" && semver.validRange(value) !== null,
                    `${entry.name} has an unsupported runtime dependency: ${name} = ${value}`,
                );
            }
        }
    }
}

export function validateLock(rootMetadata: RootMetadata, metadata: PackageMetadata[], lock: PackageLock): void {
    check(lock.lockfileVersion === 3 && lock.packages, "Expected npm lockfileVersion 3 with packages metadata");
    check(
        lock.name === rootMetadata.name && lock.version === rootMetadata.version,
        "Root lockfile name/version does not match package.json",
    );
    const lockedRoot = lock.packages[""];
    check(lockedRoot, "Missing root lockfile metadata");
    check(
        lockedRoot.name === rootMetadata.name && lockedRoot.version === rootMetadata.version,
        "Root lockfile package metadata does not match package.json",
    );
    same(lockedRoot.workspaces, rootMetadata.workspaces, "Root lockfile workspace order does not match");
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "engines"] as const) {
        same(lockedRoot[field] ?? {}, rootMetadata[field] ?? {}, `Root lockfile ${field} does not match`);
    }
    for (const [index, entry] of PACKAGES.entries()) {
        const locked = lock.packages[entry.workspace];
        check(
            locked?.name === entry.name && locked.version === metadata[index].version,
            `${entry.name} lockfile name/version mismatch`,
        );
        for (const field of [
            "dependencies",
            "devDependencies",
            "optionalDependencies",
            "peerDependencies",
            "engines",
        ] as const) {
            same(locked[field] ?? {}, metadata[index][field] ?? {}, `${entry.name} lockfile ${field} mismatch`);
        }
        const linkPath = `node_modules/${entry.name}`;
        const link = lock.packages[linkPath];
        check(
            link?.link === true && link.resolved === entry.workspace,
            `${entry.name} lockfile must link to its local workspace`,
        );
        for (const [key, value] of Object.entries(lock.packages)) {
            if (key.endsWith(`/node_modules/${entry.name}`) || key === linkPath || value.name === entry.name) {
                check(
                    key === entry.workspace || key === linkPath,
                    `${entry.name} has a registry or nested duplicate in the lockfile: ${key}`,
                );
            }
        }
    }
}

export function loadRelease(root = ROOT, { lock = true, resolution = true } = {}) {
    const rootMetadata = readJson<RootMetadata>(path.join(root, "package.json"));
    check(rootMetadata.private === true, "Repository root must be private");
    same(
        rootMetadata.workspaces,
        PACKAGES.map(entry => entry.workspace),
        "Expected only the three ordered public workspaces",
    );
    const metadata = PACKAGES.map(entry => readJson<PackageMetadata>(path.join(root, entry.workspace, "package.json")));
    const versions = Object.fromEntries(metadata.map(item => [item.name, item.version]));
    metadata.forEach((item, index) => validatePackage(item, PACKAGES[index], versions));
    if (lock) validateLock(rootMetadata, metadata, readJson<PackageLock>(path.join(root, "package-lock.json")));
    if (resolution) {
        for (const entry of PACKAGES) {
            const local = fs.realpathSync(path.join(root, "node_modules", entry.name));
            const workspace = fs.realpathSync(path.join(root, entry.workspace));
            check(local === workspace, `${entry.name} resolves outside its local workspace: ${local}`);
            for (const dependent of PACKAGES.filter(item => item.dependencies.includes(entry.name))) {
                const resolve = createRequire(path.join(root, dependent.workspace, "package.json"));
                const resolved = fs.realpathSync(resolve.resolve(`${entry.name}/package.json`));
                check(
                    resolved === fs.realpathSync(path.join(workspace, "package.json")),
                    `${dependent.name} resolves ${entry.name} from the registry instead of its workspace`,
                );
            }
        }
    }
    return { rootMetadata, metadata, versions };
}

export function run(
    command: string,
    args: string[],
    { cwd = ROOT, env = process.env, timeout = 600000, inherit = false }: RunOptions = {},
): string {
    const result = spawnSync(command, args, {
        cwd,
        env,
        timeout,
        encoding: "utf8",
        stdio: inherit ? "inherit" : "pipe",
        maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
        throw new Error(
            `${path.basename(command)} ${args.join(" ")} failed (${result.status ?? "not started"}): ${
                result.error?.message ?? (inherit ? "see command output above" : `${result.stderr}\n${result.stdout}`)
            }`,
        );
    }
    return result.stdout?.trim() ?? "";
}

export function findNpmCli(env = process.env, execPath = process.execPath): string {
    if (env.npm_execpath && /npm-cli\.js$/i.test(env.npm_execpath) && fs.existsSync(env.npm_execpath)) {
        return env.npm_execpath;
    }
    // Honor the invoking npm or the executable selected on PATH.
    const search = (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean);
    search.push(path.dirname(execPath));
    for (const directory of search) {
        for (const candidate of [
            path.join(directory, "node_modules", "npm", "bin", "npm-cli.js"),
            path.join(directory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
            path.join(directory, "npm"),
        ]) {
            if (fs.existsSync(candidate)) {
                const real = fs.realpathSync(candidate);
                if (/npm-cli\.js$/i.test(real)) return real;
            }
        }
    }
    throw new Error("Cannot locate npm-cli.js; run through the root npm scripts");
}

export function npm(args: string[], options?: RunOptions): string {
    return run(process.execPath, [findNpmCli(), ...args], options);
}

export function setVersion(
    version: string,
    root = ROOT,
    refresh: () => unknown = () => npm(["install", "--package-lock-only", "--ignore-scripts"], { cwd: root }),
): void {
    const tag = versionTag(version);
    const rootMetadata = readJson<RootMetadata>(path.join(root, "package.json"));
    check(rootMetadata.private === true, "Repository root must be private");
    same(
        rootMetadata.workspaces,
        PACKAGES.map(entry => entry.workspace),
        "Unexpected workspace order",
    );
    const paths = [
        ...PACKAGES.map(entry => path.join(root, entry.workspace, "package.json")),
        path.join(root, "package-lock.json"),
    ];
    const originals = paths.map(filename => (fs.existsSync(filename) ? fs.readFileSync(filename) : undefined));
    try {
        PACKAGES.forEach((entry, index) => {
            const original = originals[index];
            check(original, `Missing package metadata: ${paths[index]}`);
            const metadata: PackageMetadata = JSON.parse(original.toString("utf8"));
            check(metadata.name === entry.name, `Unexpected package name in ${entry.workspace}`);
            metadata.version = version;
            metadata.dependencies = {
                ...metadata.dependencies,
                ...Object.fromEntries(entry.dependencies.map(name => [name, version])),
            };
            metadata.publishConfig = { ...metadata.publishConfig, access: "public", tag };
            validatePackage(metadata, entry, Object.fromEntries(PACKAGES.map(item => [item.name, version])));
            writeJson(paths[index], metadata);
        });
        refresh();
        loadRelease(root, { resolution: false });
    } catch (error) {
        const failures: unknown[] = [];
        paths.forEach((filename, index) => {
            try {
                const original = originals[index];
                if (original === undefined) fs.rmSync(filename, { force: true });
                else fs.writeFileSync(filename, original);
            } catch (restoreError) {
                failures.push(restoreError);
            }
        });
        if (failures.length)
            throw new AggregateError([error, ...failures], "Version update failed and rollback was incomplete");
        throw new Error(`Version update rolled back: ${errorMessage(error)}`, { cause: error });
    }
}

export function bumpPatch(root = ROOT, refresh?: () => unknown): string {
    const { versions } = loadRelease(root, { resolution: false });
    const version = versions[PACKAGES[0].name];
    check(
        Object.values(versions).every(value => value === version),
        "Legacy patch requires a shared release version; use prepare for independently versioned packages",
    );
    const next = semver.inc(version, "patch");
    check(next !== null, `Cannot increment patch version: ${version}`);
    setVersion(next, root, refresh);
    return next;
}

export function resolvePreparation(args: string[]): { entry: PackageEntry; increment: "major" | "minor" | "patch" } {
    check(args.length === 2, "Expected exactly <project> <major|minor|patch>");
    const [project, increment] = args;
    const entry = PACKAGES.find(item => item.slug === project || item.name === project);
    check(entry, `Unknown release project: ${project}`);
    check(
        increment === "major" || increment === "minor" || increment === "patch",
        `Invalid release increment: ${increment}`,
    );
    return { entry, increment };
}

export function rollChangelog(source: string, version: string, date: string): string {
    const lines = (source.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) ?? []).filter(Boolean);
    const headings: { title: string; level: number; offset: number; end: number; body: number; setext?: boolean }[] =
        [];
    let fence: string | undefined;
    let comment = false;
    let previous: { text: string; offset: number } | undefined;
    let offset = 0;
    for (const line of lines) {
        const text = line.replace(/[\r\n]+$/, "");
        const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
        if (fence) {
            if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && marker[2].trim() === "")
                fence = undefined;
            previous = undefined;
        } else if (comment || /^ {0,3}<!--/.test(text)) {
            comment = !text.includes("-->");
            previous = undefined;
        } else if (marker) {
            fence = marker[1];
            previous = undefined;
        } else {
            const heading = /^ {0,3}(#{1,2})(?:[ \t]+(.*)|[ \t]*)$/.exec(text);
            if (heading) {
                const title = (heading[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
                headings.push({
                    title,
                    level: heading[1].length,
                    offset,
                    end: offset + text.length,
                    body: offset + line.length,
                });
            }
            if (/^ {0,3}##[^#\r\n]*unreleased/i.test(text)) {
                check(
                    heading?.[1] === "##" && (heading[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim() === "Unreleased",
                    "Malformed or ambiguous Unreleased heading; expected ## Unreleased",
                );
            }
            if (/^ {0,3}-{3,}[ \t]*$/.test(text)) {
                if (previous) {
                    headings.push({
                        title: previous.text.trim(),
                        level: 2,
                        offset: previous.offset,
                        end: offset + text.length,
                        body: offset + line.length,
                        setext: true,
                    });
                }
            }
            previous = !heading && text.trim() && !/^ {0,3}-{3,}[ \t]*$/.test(text) ? { text, offset } : undefined;
        }
        offset += line.length;
    }
    const unreleased = headings.filter(heading => /\bunreleased\b/i.test(heading.title));
    check(
        unreleased.length === 1 &&
            unreleased[0].level === 2 &&
            unreleased[0].title === "Unreleased" &&
            !unreleased[0].setext,
        "Expected exactly one ## Unreleased section",
    );
    const current = unreleased[0];
    const releaseHeading = new RegExp(
        `^(?:v?${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|\\[v?${version.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
        )}\\])(?:[ \\t(]|$)`,
    );
    check(
        !headings.some(({ title, level }) => level === 2 && releaseHeading.test(title)),
        `Changelog already contains release ${version}`,
    );
    const end = headings.find(heading => heading.offset > current.offset)?.offset ?? source.length;
    const body = source
        .slice(current.body, end)
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/^ {0,3}#{1,6}(?:[ \t].*)?$/gm, "")
        .replace(/^ {0,3}(?:`{3,}|~{3,}).*$/gm, "")
        .trim();
    check(body.length > 0, "Unreleased section must not be empty");
    return `${source.slice(0, current.offset)}## ${version} - ${date}${source.slice(current.end)}`;
}

export function planPreparation(
    args: string[],
    root = ROOT,
    date = new Date().toISOString().slice(0, 10),
    resolution = true,
) {
    const { entry, increment } = resolvePreparation(args);
    const originals = new Map<string, Buffer | undefined>();
    const relativeFiles = [
        "package.json",
        "package-lock.json",
        ...PACKAGES.flatMap(item => [`${item.workspace}/package.json`, `${item.workspace}/CHANGELOG.md`]),
    ];
    for (const relative of relativeFiles) {
        const filename = path.join(root, relative);
        originals.set(filename, fs.existsSync(filename) ? fs.readFileSync(filename) : undefined);
    }
    const release = loadRelease(root, { resolution });
    const oldVersion = release.versions[entry.name];
    const version = semver.inc(oldVersion, increment);
    check(version !== null, `Cannot increment ${oldVersion}: ${increment}`);
    const changes = new Map<string, Buffer>();
    const changelog = path.join(root, entry.workspace, "CHANGELOG.md");
    const changelogBytes = originals.get(changelog);
    check(changelogBytes, `Missing changelog: ${changelog}`);
    changes.set(changelog, Buffer.from(rollChangelog(changelogBytes.toString("utf8"), version, date)));
    const metadata = structuredClone(release.metadata);
    for (const [index, item] of PACKAGES.entries()) {
        if (item.name === entry.name) {
            metadata[index].version = version;
            metadata[index].publishConfig.tag = versionTag(version);
        }
        if (item.dependencies.includes(entry.name)) metadata[index].dependencies[entry.name] = version;
        if (item.name === entry.name || item.dependencies.includes(entry.name)) {
            changes.set(
                path.join(root, item.workspace, "package.json"),
                Buffer.from(`${JSON.stringify(metadata[index], null, 4)}\n`),
            );
        }
    }
    const versions = { ...release.versions, [entry.name]: version };
    metadata.forEach((item, index) => validatePackage(item, PACKAGES[index], versions));
    const lockBytes = originals.get(path.join(root, "package-lock.json"));
    check(lockBytes, "Missing root lockfile");
    const expectedLock: PackageLock = JSON.parse(lockBytes.toString("utf8"));
    PACKAGES.forEach((item, index) => {
        expectedLock.packages[item.workspace].version = metadata[index].version;
        // Only internal pins and the selected version may change in the lock.
        for (const name of item.dependencies) {
            const dependencies = expectedLock.packages[item.workspace].dependencies;
            check(dependencies, `Missing locked dependencies: ${item.name}`);
            dependencies[name] = metadata[index].dependencies[name];
        }
    });
    return {
        project: entry.slug,
        oldVersion,
        version,
        date,
        originals,
        changes,
        expectedLock,
        metadata,
        rootMetadata: release.rootMetadata,
    };
}

export function prepareRelease(
    args: string[],
    { root = ROOT, execute = npm, now = () => new Date(), resolution = true }: PreparationOptions = {},
) {
    resolvePreparation(args);
    const plan = planPreparation(args, root, now().toISOString().slice(0, 10), resolution);
    const expected = new Map(plan.originals);
    const owned = new Map<string, Buffer>();
    const readBytes = (filename: string): Buffer | undefined =>
        fs.existsSync(filename) ? fs.readFileSync(filename) : undefined;
    const equalBytes = (left: Buffer | undefined, right: Buffer | undefined): boolean =>
        left === undefined ? right === undefined : right !== undefined && left.equals(right);
    const guard = (): void => {
        for (const [filename, bytes] of expected) {
            check(equalBytes(bytes, readBytes(filename)), `Concurrent release-file edit detected: ${filename}`);
        }
    };
    const write = (filename: string, bytes: Buffer): void => {
        guard();
        owned.set(filename, bytes);
        fs.writeFileSync(filename, bytes);
        expected.set(filename, bytes);
    };
    guard();
    for (const script of ["lint", "build", "test"]) {
        console.log(`Release prerequisite: npm ${script === "test" ? "test" : `run ${script}`}`);
        execute(script === "test" ? ["test"] : ["run", script], { cwd: root, inherit: true });
        guard();
    }
    try {
        guard();
        for (const [filename, bytes] of plan.changes) write(filename, bytes);
        // Refresh an isolated copy so npm cannot overwrite concurrent edits to the real lockfile.
        const staging = fs.mkdtempSync(path.join(os.tmpdir(), "powerquery-release-lock-"));
        let lockBytes;
        try {
            for (const relative of [
                "package.json",
                "package-lock.json",
                ...PACKAGES.map(entry => `${entry.workspace}/package.json`),
                ".npmrc",
            ]) {
                const source = path.join(root, relative);
                if (!fs.existsSync(source)) continue;
                const destination = path.join(staging, relative);
                fs.mkdirSync(path.dirname(destination), { recursive: true });
                fs.copyFileSync(source, destination);
            }
            execute(["install", "--package-lock-only", "--ignore-scripts"], { cwd: staging, inherit: true });
            guard();
            const lockfile = path.join(staging, "package-lock.json");
            const lock = readJson<PackageLock>(lockfile);
            validateLock(plan.rootMetadata, plan.metadata, lock);
            same(lock, plan.expectedLock, "Lock refresh changed unrelated metadata or dependencies");
            lockBytes = fs.readFileSync(lockfile);
        } finally {
            fs.rmSync(staging, { recursive: true, force: true });
        }
        write(path.join(root, "package-lock.json"), lockBytes);
        loadRelease(root, { resolution });
        console.log("Release validation: npm run validate:release");
        execute(["run", "validate:release"], { cwd: root, inherit: true });
        guard();
        loadRelease(root, { resolution });
        guard();
    } catch (error) {
        const failures: unknown[] = [];
        for (const [filename, bytes] of owned) {
            try {
                const current = readBytes(filename);
                if (equalBytes(plan.originals.get(filename), current)) continue;
                check(equalBytes(bytes, current), `Rollback conflict; preserved concurrent edit: ${filename}`);
                const original = plan.originals.get(filename);
                if (original === undefined) fs.rmSync(filename, { force: true });
                else fs.writeFileSync(filename, original);
            } catch (restoreError) {
                failures.push(restoreError);
            }
        }
        if (failures.length) {
            throw new AggregateError(
                [error, ...failures],
                `Release preparation failed; rollback incomplete: ${[error, ...failures].map(errorMessage).join("; ")}`,
            );
        }
        throw new Error(`Release preparation rolled back: ${errorMessage(error)}`, { cause: error });
    }
    return {
        project: plan.project,
        oldVersion: plan.oldVersion,
        version: plan.version,
        date: plan.date,
        files: [...owned.keys()].map(filename => path.relative(root, filename)),
    };
}

export async function main(args: string[]): Promise<void> {
    const [command, ...rest] = args;
    check(
        ["version", "patch", "pack", "validate", "prepare"].includes(command) &&
            (command === "prepare" ? rest.length === 2 : command === "version" ? rest.length === 1 : rest.length === 0),
        "Usage: ts-node scripts/release.ts prepare <project> <major|minor|patch> | version <SemVer> | patch | pack | validate",
    );
    if (command === "prepare") {
        const result = prepareRelease(rest);
        console.log(
            `Prepared ${result.project}: ${result.oldVersion} -> ${result.version} (${result.date})\n${result.files.join(
                "\n",
            )}`,
        );
    } else if (command === "version") {
        setVersion(rest[0]);
        console.log(`Set the public release group to ${rest[0]}`);
    } else if (command === "patch") {
        console.log(`Set the public release group to ${bumpPatch()}`);
    } else {
        const artifacts = await import("./release-artifacts");
        const manifest = await artifacts.packRelease(ROOT);
        if (command === "validate") await (await import("./release-consumer")).validateConsumer(ROOT, manifest);
        console.log(
            `${command === "validate" ? "Validated" : "Packed"} public packages: ${manifest.packages
                .map(item => `${item.name}@${item.version}`)
                .join(", ")}`,
        );
    }
}

if (require.main === module)
    main(process.argv.slice(2)).catch(error => {
        console.error(`Release failed: ${errorMessage(error)}`);
        process.exitCode = 1;
    });

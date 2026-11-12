import * as fs from "node:fs";
import * as path from "node:path";
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

export function validatePackage(metadata: PackageMetadata, entry: PackageEntry, version: string): void {
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
        Object.fromEntries(entry.dependencies.map(name => [name, version])),
        `${entry.name} must have the exact complete internal dependency closure at ${version}`,
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
    const version = metadata[0].version;
    metadata.forEach((item, index) => validatePackage(item, PACKAGES[index], version));
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
    return { rootMetadata, metadata, version };
}

export function run(
    command: string,
    args: string[],
    { cwd = ROOT, env = process.env, timeout = 600000 }: RunOptions = {},
): string {
    const result = spawnSync(command, args, {
        cwd,
        env,
        timeout,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
        throw new Error(
            `${path.basename(command)} failed (${result.status ?? "not started"}): ${
                result.error?.message ?? `${result.stderr}\n${result.stdout}`
            }`,
        );
    }
    return result.stdout.trim();
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
            validatePackage(metadata, entry, version);
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
    const { version } = loadRelease(root, { resolution: false });
    const next = semver.inc(version, "patch");
    check(next !== null, `Cannot increment patch version: ${version}`);
    setVersion(next, root, refresh);
    return next;
}

export async function main(args: string[]): Promise<void> {
    const [command, ...rest] = args;
    check(
        ["version", "patch", "pack", "validate"].includes(command) &&
            (command === "version" ? rest.length === 1 : rest.length === 0),
        "Usage: ts-node scripts/release.ts version <SemVer> | patch | pack | validate",
    );
    if (command === "version") {
        setVersion(rest[0]);
        console.log(`Set the public release group to ${rest[0]}`);
    } else if (command === "patch") {
        console.log(`Set the public release group to ${bumpPatch()}`);
    } else {
        const artifacts = await import("./release-artifacts");
        const manifest = await artifacts.packRelease(ROOT);
        if (command === "validate") await (await import("./release-consumer")).validateConsumer(ROOT, manifest);
        console.log(`${command === "validate" ? "Validated" : "Packed"} public release ${manifest.releaseVersion}`);
    }
}

if (require.main === module)
    main(process.argv.slice(2)).catch(error => {
        console.error(`Release failed: ${errorMessage(error)}`);
        process.exitCode = 1;
    });

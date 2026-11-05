"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const semver = require("semver");

const ROOT = path.resolve(__dirname, "..");
const PACKAGES = Object.freeze(
    ["powerquery-parser", "powerquery-formatter", "powerquery-language-services"].map((slug, index, slugs) => ({
        slug,
        name: `@microsoft/${slug}`,
        workspace: `packages/${slug}`,
        main: `lib/${slug}/index.js`,
        types: `lib/${slug}/index.d.ts`,
        dependencies: slugs.slice(0, index).map((dependency) => `@microsoft/${dependency}`),
    })),
);

function check(condition, message) {
    if (!condition) throw new Error(message);
}

function readJson(filename) {
    try {
        return JSON.parse(fs.readFileSync(filename, "utf8"));
    } catch (error) {
        throw new Error(`Cannot read JSON ${filename}: ${error.message}`, { cause: error });
    }
}

function writeJson(filename, value) {
    fs.writeFileSync(filename, `${JSON.stringify(value, null, 4)}\n`);
}

function versionTag(version) {
    check(
        typeof version === "string" && version.trim() === version &&
            /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version) &&
            semver.valid(version) !== null,
        `Expected a strict full SemVer without a leading v: ${String(version)}`,
    );
    return semver.prerelease(version) === null ? "latest" : "next";
}

function same(actual, expected, message) {
    const sort = (value) => Array.isArray(value) ? value.map(sort) :
        value !== null && typeof value === "object"
            ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]))
            : value;
    const canonical = (value) => JSON.stringify(sort(value));
    check(canonical(actual) === canonical(expected), message);
}

function internalDependencies(metadata) {
    return Object.fromEntries(
        Object.entries(metadata.dependencies ?? {}).filter(([name]) =>
            PACKAGES.some((entry) => entry.name === name)),
    );
}

function validatePackage(metadata, entry, version) {
    check(metadata.name === entry.name, `Unexpected package name in ${entry.workspace}`);
    check(metadata.private === undefined || metadata.private === false, `${entry.name} must be public`);
    check(metadata.main === entry.main && metadata.types === entry.types,
        `${entry.name} must expose ${entry.main} and ${entry.types}`);
    check(metadata.version === version, `${entry.name} must have release version ${version}`);
    const tag = versionTag(version);
    check(metadata.publishConfig?.access === "public" && metadata.publishConfig?.tag === tag,
        `${entry.name} publishConfig must specify access public and tag ${tag}`);
    check(Object.keys(metadata.publishConfig).every((key) => ["access", "tag"].includes(key)),
        `${entry.name} contains private or unexpected publish settings`);
    same(internalDependencies(metadata), Object.fromEntries(entry.dependencies.map((name) => [name, version])),
        `${entry.name} must have the exact complete internal dependency closure at ${version}`);
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        for (const name of Object.keys(metadata[section] ?? {})) {
            if (name.startsWith("@microsoft/powerquery-")) {
                check(section === "dependencies" && entry.dependencies.includes(name),
                    `${entry.name} has an unexpected internal dependency in ${section}: ${name}`);
            }
        }
        for (const section of ["dependencies", "peerDependencies", "optionalDependencies"]) {
            for (const [name, value] of Object.entries(metadata[section] ?? {})) {
                check(typeof value === "string" && semver.validRange(value) !== null,
                    `${entry.name} has an unsupported runtime dependency: ${name} = ${value}`);
            }
        }
    }
}

function validateLock(rootMetadata, metadata, lock) {
    check(lock.lockfileVersion === 3 && lock.packages, "Expected npm lockfileVersion 3 with packages metadata");
    check(lock.name === rootMetadata.name && lock.version === rootMetadata.version,
        "Root lockfile name/version does not match package.json");
    const lockedRoot = lock.packages[""];
    check(lockedRoot, "Missing root lockfile metadata");
    check(lockedRoot.name === rootMetadata.name && lockedRoot.version === rootMetadata.version,
        "Root lockfile package metadata does not match package.json");
    same(lockedRoot.workspaces, rootMetadata.workspaces, "Root lockfile workspace order does not match");
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "engines"]) {
        same(lockedRoot[field] ?? {}, rootMetadata[field] ?? {}, `Root lockfile ${field} does not match`);
    }
    for (const [index, entry] of PACKAGES.entries()) {
        const locked = lock.packages[entry.workspace];
        check(locked?.name === entry.name && locked.version === metadata[index].version,
            `${entry.name} lockfile name/version mismatch`);
        for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "engines"]) {
            same(locked[field] ?? {}, metadata[index][field] ?? {}, `${entry.name} lockfile ${field} mismatch`);
        }
        const linkPath = `node_modules/${entry.name}`;
        const link = lock.packages[linkPath];
        check(link?.link === true && link.resolved === entry.workspace,
            `${entry.name} lockfile must link to its local workspace`);
        for (const [key, value] of Object.entries(lock.packages)) {
            if (key.endsWith(`/node_modules/${entry.name}`) || key === linkPath || value.name === entry.name) {
                check(key === entry.workspace || key === linkPath,
                    `${entry.name} has a registry or nested duplicate in the lockfile: ${key}`);
            }
        }
    }
}

function loadRelease(root = ROOT, { lock = true, resolution = true } = {}) {
    const rootMetadata = readJson(path.join(root, "package.json"));
    check(rootMetadata.private === true, "Repository root must be private");
    same(rootMetadata.workspaces, PACKAGES.map((entry) => entry.workspace), "Expected only the three ordered public workspaces");
    const metadata = PACKAGES.map((entry) => readJson(path.join(root, entry.workspace, "package.json")));
    const version = metadata[0].version;
    metadata.forEach((item, index) => validatePackage(item, PACKAGES[index], version));
    if (lock) validateLock(rootMetadata, metadata, readJson(path.join(root, "package-lock.json")));
    if (resolution) {
        for (const entry of PACKAGES) {
            const local = fs.realpathSync(path.join(root, "node_modules", entry.name));
            const workspace = fs.realpathSync(path.join(root, entry.workspace));
            check(local === workspace, `${entry.name} resolves outside its local workspace: ${local}`);
            for (const dependent of PACKAGES.filter((item) => item.dependencies.includes(entry.name))) {
                const { createRequire } = require("node:module");
                const resolve = createRequire(path.join(root, dependent.workspace, "package.json"));
                const resolved = fs.realpathSync(resolve.resolve(`${entry.name}/package.json`));
                check(resolved === fs.realpathSync(path.join(workspace, "package.json")),
                    `${dependent.name} resolves ${entry.name} from the registry instead of its workspace`);
            }
        }
    }
    return { rootMetadata, metadata, version };
}

function run(command, args, { cwd = ROOT, env = process.env, timeout = 600000 } = {}) {
    const result = spawnSync(command, args, { cwd, env, timeout, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
        throw new Error(`${path.basename(command)} failed (${result.status ?? "not started"}): ${
            result.error?.message ?? `${result.stderr}\n${result.stdout}`
        }`);
    }
    return result.stdout.trim();
}

function findNpmCli(env = process.env, execPath = process.execPath) {
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

function npm(args, options) {
    return run(process.execPath, [findNpmCli(), ...args], options);
}

function setVersion(version, root = ROOT, refresh = () => npm(
    ["install", "--package-lock-only", "--ignore-scripts"], { cwd: root },
)) {
    const tag = versionTag(version);
    const rootMetadata = readJson(path.join(root, "package.json"));
    check(rootMetadata.private === true, "Repository root must be private");
    same(rootMetadata.workspaces, PACKAGES.map((entry) => entry.workspace), "Unexpected workspace order");
    const paths = [...PACKAGES.map((entry) => path.join(root, entry.workspace, "package.json")),
        path.join(root, "package-lock.json")];
    const originals = paths.map((filename) => fs.existsSync(filename) ? fs.readFileSync(filename) : undefined);
    try {
        PACKAGES.forEach((entry, index) => {
            const metadata = JSON.parse(originals[index].toString("utf8"));
            check(metadata.name === entry.name, `Unexpected package name in ${entry.workspace}`);
            metadata.version = version;
            metadata.dependencies = { ...metadata.dependencies, ...Object.fromEntries(entry.dependencies.map((name) => [name, version])) };
            metadata.publishConfig = { ...metadata.publishConfig, access: "public", tag };
            validatePackage(metadata, entry, version);
            writeJson(paths[index], metadata);
        });
        refresh();
        loadRelease(root, { resolution: false });
    } catch (error) {
        const failures = [];
        paths.forEach((filename, index) => {
            try {
                if (originals[index] === undefined) fs.rmSync(filename, { force: true });
                else fs.writeFileSync(filename, originals[index]);
            } catch (restoreError) {
                failures.push(restoreError);
            }
        });
        if (failures.length) throw new AggregateError([error, ...failures], "Version update failed and rollback was incomplete");
        throw new Error(`Version update rolled back: ${error.message}`, { cause: error });
    }
}

async function main(args) {
    const [command, ...rest] = args;
    check(["version", "pack", "validate"].includes(command) &&
        (command === "version" ? rest.length === 1 : rest.length === 0),
    "Usage: node scripts/release.cjs version <SemVer> | pack | validate");
    if (command === "version") {
        setVersion(rest[0]);
        console.log(`Set the public release group to ${rest[0]}`);
    } else {
        const artifacts = require("./release-artifacts.cjs");
        const manifest = await artifacts.packRelease(ROOT);
        if (command === "validate") await require("./release-consumer.cjs").validateConsumer(ROOT, manifest);
        console.log(`${command === "validate" ? "Validated" : "Packed"} public release ${manifest.releaseVersion}`);
    }
}

module.exports = { ROOT, PACKAGES, check, readJson, writeJson, same, versionTag, internalDependencies,
    validatePackage, validateLock, loadRelease, run, findNpmCli, npm, setVersion, main };

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
    console.error(`Release failed: ${error.message}`);
    process.exitCode = 1;
});

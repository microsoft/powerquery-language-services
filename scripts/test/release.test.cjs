"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const tar = require("tar");
const { PACKAGES, versionTag, validatePackage, validateLock, setVersion, bumpPatch, writeJson, loadRelease, findNpmCli } = require("../release.cjs");
const { safeRelative, inside, integrity, allowedFile, requireOutputs, requireBuiltOutputs, inspectTarball,
    validateManifest, verifyManifest } = require("../release-artifacts.cjs");
const { cleanEnvironment } = require("../release-consumer.cjs");
const { localizationFiles } = require("../localization.cjs");

const VERSION = "5.0.0";
const clone = (value) => structuredClone(value);

function packageMetadata(entry, version = VERSION) {
    return {
        name: entry.name, version, main: entry.main, types: entry.types,
        dependencies: Object.fromEntries(entry.dependencies.map((name) => [name, version])),
        publishConfig: { access: "public", tag: versionTag(version) },
    };
}

function repository() {
    const root = {
        name: "powerquery-workspace", version: "1.0.0", private: true,
        workspaces: PACKAGES.map((entry) => entry.workspace),
        devDependencies: { typescript: "^5.9.2" },
    };
    const metadata = PACKAGES.map((entry) => packageMetadata(entry));
    const lock = {
        name: root.name, version: root.version, lockfileVersion: 3,
        packages: { "": clone(root) },
    };
    PACKAGES.forEach((entry, index) => {
        lock.packages[entry.workspace] = clone(metadata[index]);
        lock.packages[`node_modules/${entry.name}`] = { resolved: entry.workspace, link: true };
    });
    return { root, metadata, lock };
}

function fixture(context) {
    const directory = fs.mkdtempSync(path.join(__dirname, "release-fixture-"));
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function createRepository(directory) {
    const data = repository();
    writeJson(path.join(directory, "package.json"), data.root);
    writeJson(path.join(directory, "package-lock.json"), data.lock);
    fs.writeFileSync(path.join(directory, "LICENSE"), "MIT");
    PACKAGES.forEach((entry, index) => {
        fs.mkdirSync(path.join(directory, entry.workspace), { recursive: true });
        writeJson(path.join(directory, entry.workspace, "package.json"), data.metadata[index]);
    });
    return data;
}

function createManifest(directory) {
    return {
        schemaVersion: 1, releaseVersion: VERSION, sourceCommit: "a".repeat(40),
        packages: PACKAGES.map((entry) => {
            const relative = `npm/${entry.slug}/${entry.slug}-5.0.0.tgz`;
            const filename = path.join(directory, relative);
            fs.mkdirSync(path.dirname(filename), { recursive: true });
            fs.writeFileSync(filename, entry.name);
            return {
                name: entry.name, version: VERSION, workspace: entry.workspace, tarball: relative,
                integrity: integrity(fs.readFileSync(filename)),
                internalDependencies: packageMetadata(entry).dependencies, distTag: "latest",
            };
        }),
    };
}

async function createTar(directory, entry, options = {}) {
    const packageDirectory = path.join(directory, "package");
    const metadata = options.metadata ?? packageMetadata(entry);
    for (const [file, bytes] of Object.entries({
        "package.json": JSON.stringify(metadata),
        [entry.main]: "module.exports = {};",
        [entry.types]: "export {};",
        "README.md": "Readme",
        LICENSE: "MIT",
        ...options.files,
    })) {
        if (options.omit === file) continue;
        const filename = path.join(packageDirectory, file);
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        fs.writeFileSync(filename, bytes);
    }
    const filename = path.join(directory, "test.tgz");
    await tar.c({ cwd: directory, file: filename, gzip: true }, ["package"]);
    return filename;
}

test("accepts full stable, prerelease and build SemVer and chooses the correct tag", () => {
    for (const version of ["0.0.0", VERSION, "5.0.0+build.42"]) assert.equal(versionTag(version), "latest");
    for (const version of ["5.0.0-beta.1", "5.0.0-0", "5.0.0-rc.2+build.42"]) assert.equal(versionTag(version), "next");
});

test("rejects incomplete, normalized, range and invalid versions", () => {
    for (const version of [undefined, null, 5, "", "v5.0.0", "=5.0.0", "5", "5.0", "05.0.0",
        "5.01.0", "5.0.01", "5.0.0-01", "5.0.0-", "5.0.0+", "5.0.0-a..b", "^5.0.0", " 5.0.0", "5.0.0\n"]) {
        assert.throws(() => versionTag(version), /strict full SemVer/);
    }
});

test("npm selection honors the invoking npm and PATH before Node's bundled npm", (context) => {
    const directory = fixture(context);
    const global = path.join(directory, "global");
    const bundled = path.join(directory, "bundled");
    const makeCli = (base) => {
        const cli = path.join(base, "node_modules", "npm", "bin", "npm-cli.js");
        fs.mkdirSync(path.dirname(cli), { recursive: true });
        fs.writeFileSync(cli, "");
        return fs.realpathSync(cli);
    };
    const globalCli = makeCli(global);
    const bundledCli = makeCli(bundled);
    assert.equal(findNpmCli({ PATH: global }, path.join(bundled, "node.exe")), globalCli);
    assert.equal(findNpmCli({ npm_execpath: bundledCli, PATH: global }, path.join(bundled, "node.exe")), bundledCli);
    assert.equal(findNpmCli({ PATH: "" }, path.join(bundled, "node.exe")), bundledCli);
    assert.throws(() => findNpmCli({}, path.join(directory, "missing", "node.exe")), /Cannot locate npm/);
});

test("enforces public names, entrypoints, equal versions, dist tags and exact graph", () => {
    PACKAGES.forEach((entry) => validatePackage(packageMetadata(entry), entry, VERSION));
    const entry = PACKAGES[2];
    for (const mutate of [
        (item) => { item.name = "unscoped"; },
        (item) => { item.private = true; },
        (item) => { item.main = "src/index.ts"; },
        (item) => { item.types = "missing.d.ts"; },
        (item) => { item.version = "4.0.0"; },
        (item) => { item.publishConfig.tag = "next"; },
        (item) => { item.publishConfig.registry = "https://private.invalid"; },
        (item) => { delete item.dependencies[PACKAGES[0].name]; },
        (item) => { item.dependencies[PACKAGES[1].name] = "^5.0.0"; },
        (item) => { item.devDependencies = { [PACKAGES[0].name]: VERSION }; },
        (item) => { item.optionalDependencies = { "@microsoft/powerquery-secret": VERSION }; },
        (item) => { item.peerDependencies = { [PACKAGES[1].name]: VERSION }; },
    ]) {
        const item = packageMetadata(entry);
        mutate(item);
        assert.throws(() => validatePackage(item, entry, VERSION));
    }
    const parser = packageMetadata(PACKAGES[0]);
    parser.dependencies[PACKAGES[1].name] = VERSION;
    assert.throws(() => validatePackage(parser, PACKAGES[0], VERSION), /closure/);
});

test("validates lockfile root and workspace metadata and forbids registry duplicates", () => {
    const baseline = repository();
    validateLock(baseline.root, baseline.metadata, baseline.lock);
    for (const mutate of [
        (lock) => { lock.lockfileVersion = 2; },
        (lock) => { lock.version = "2.0.0"; },
        (lock) => { lock.packages[""].workspaces.reverse(); },
        (lock) => { lock.packages[""].devDependencies.typescript = "1.0.0"; },
        (lock) => { lock.packages[PACKAGES[0].workspace].version = "4.0.0"; },
        (lock) => { delete lock.packages[PACKAGES[2].workspace].dependencies[PACKAGES[1].name]; },
        (lock) => { lock.packages[`node_modules/${PACKAGES[0].name}`].resolved = "https://registry.npmjs.org/parser.tgz"; },
        (lock) => { delete lock.packages[`node_modules/${PACKAGES[1].name}`].link; },
        (lock) => { lock.packages[`${PACKAGES[2].workspace}/node_modules/${PACKAGES[0].name}`] = { version: VERSION }; },
    ]) {
        const lock = clone(baseline.lock);
        mutate(lock);
        assert.throws(() => validateLock(baseline.root, baseline.metadata, lock));
    }
});

test("rejects private roots and extra/reordered workspaces", (context) => {
    const directory = fixture(context);
    const data = createRepository(directory);
    loadRelease(directory, { resolution: false });
    for (const root of [
        { ...data.root, private: false },
        { ...data.root, workspaces: [...data.root.workspaces].reverse() },
        { ...data.root, workspaces: [...data.root.workspaces, "packages/private"] },
    ]) {
        writeJson(path.join(directory, "package.json"), root);
        assert.throws(() => loadRelease(directory, { resolution: false }));
    }
});

test("rejects installed registry copies instead of local workspace resolution", (context) => {
    const directory = fixture(context);
    createRepository(directory);
    fs.mkdirSync(path.join(directory, "node_modules", PACKAGES[0].name), { recursive: true });
    assert.throws(() => loadRelease(directory), /resolves outside its local workspace/);
});

test("version updates all three versions/edges/tags and refreshes the lock once", (context) => {
    const directory = fixture(context);
    const data = createRepository(directory);
    let calls = 0;
    setVersion("5.1.0-rc.1+build.4", directory, () => {
        calls++;
        PACKAGES.forEach((entry) => {
            data.lock.packages[entry.workspace] = JSON.parse(fs.readFileSync(path.join(directory, entry.workspace, "package.json")));
        });
        writeJson(path.join(directory, "package-lock.json"), data.lock);
    });
    assert.equal(calls, 1);
    const release = loadRelease(directory, { resolution: false });
    assert.equal(release.version, "5.1.0-rc.1+build.4");
    for (const item of release.metadata) assert.equal(item.publishConfig.tag, "next");
});

test("patch increments the shared version and exact edges through reviewed preparation", (context) => {
    const directory = fixture(context);
    const data = createRepository(directory);
    let calls = 0;
    const next = bumpPatch(directory, () => {
        calls++;
        for (const entry of PACKAGES) {
            data.lock.packages[entry.workspace] = JSON.parse(fs.readFileSync(path.join(directory, entry.workspace, "package.json")));
        }
        writeJson(path.join(directory, "package-lock.json"), data.lock);
    });
    assert.equal(next, "5.0.1");
    assert.equal(calls, 1);
    const release = loadRelease(directory, { resolution: false });
    assert.equal(release.version, next);
    for (const [index, metadata] of release.metadata.entries()) {
        assert.equal(metadata.publishConfig.tag, "latest");
        for (const name of PACKAGES[index].dependencies) assert.equal(metadata.dependencies[name], next);
    }
});

test("patch rejects inconsistent versions without changing manifests", (context) => {
    const directory = fixture(context);
    createRepository(directory);
    const file = path.join(directory, PACKAGES[1].workspace, "package.json");
    const metadata = JSON.parse(fs.readFileSync(file));
    metadata.version = "6.0.0";
    writeJson(file, metadata);
    const before = fs.readFileSync(file);
    assert.throws(() => bumpPatch(directory, () => { throw new Error("Must not refresh"); }), /release version/);
    assert.deepEqual(fs.readFileSync(file), before);
});

test("failed lock refresh or stale successful lock rolls back original bytes", (context) => {
    const directory = fixture(context);
    createRepository(directory);
    const paths = [...PACKAGES.map((entry) => path.join(directory, entry.workspace, "package.json")),
        path.join(directory, "package-lock.json")];
    const bytes = paths.map((filename) => fs.readFileSync(filename));
    for (const refresh of [
        () => { fs.writeFileSync(paths[3], "broken lock"); throw new Error("npm failed"); },
        () => {},
    ]) {
        assert.throws(() => setVersion("6.0.0", directory, refresh), /rolled back/);
        paths.forEach((filename, index) => assert.deepEqual(fs.readFileSync(filename), bytes[index]));
    }
});

test("failed refresh removes a newly created lockfile if none existed", (context) => {
    const directory = fixture(context);
    createRepository(directory);
    const lock = path.join(directory, "package-lock.json");
    fs.rmSync(lock);
    assert.throws(() => setVersion("6.0.0", directory, () => {
        fs.writeFileSync(lock, "{}");
        throw new Error("refresh failure");
    }), /rolled back/);
    assert.equal(fs.existsSync(lock), false);
});

test("paths reject traversal, absolutes, drive paths, backslashes and control characters", (context) => {
    const directory = fixture(context);
    assert.equal(safeRelative("npm/parser/a.tgz"), "npm/parser/a.tgz");
    assert.equal(inside(directory, "npm/parser/a.tgz"), path.join(directory, "npm", "parser", "a.tgz"));
    for (const value of ["", null, "/absolute", "../outside", "a/../b", "./a", "a//b", "C:/secret", "a\\b", "a/\0b", "a/\nb", "a/",
        "a/.. /b", "a/con.tgz", "a/foo.", "a/foo ", "a/*.tgz"]) {
        assert.throws(() => safeRelative(value), /Unsafe relative path/);
        assert.throws(() => inside(directory, value), /Unsafe relative path/);
    }
});

test("output paths reject directory symlinks/junctions", (context) => {
    const directory = fixture(context);
    const target = path.join(directory, "target");
    const link = path.join(directory, "link");
    fs.mkdirSync(target);
    fs.symlinkSync(target, link, "junction");
    assert.throws(() => inside(directory, "link/a.tgz"), /Symlink in output path/);
    assert.throws(() => inside(link, "a.tgz"), /Symlink output directory/);
});

test("runtime allowlist excludes sources, tests, build metadata and npm auth", () => {
    const entry = PACKAGES[0];
    for (const file of [entry.main, entry.types, `${entry.main}.map`, "README.md", "CHANGELOG.md", "LICENSE", "NOTICE.txt",
        `lib/${entry.slug}/localization/templates/template.fr-FR.json`,
        `lib/${entry.slug}/localization/bundles/bundle.l10n.json`,
        `lib/${entry.slug}/localization/bundles/bundle.l10n.fr-FR.json`]) assert.equal(allowedFile(file, entry), true, file);
    for (const file of [".npmrc", "package-lock.json", "tsconfig.tsbuildinfo", "src/index.ts", "ARCHITECTURE.md",
        `lib/${entry.slug}/test/a.js`, "lib/test/a.js", `lib/${entry.slug}/benchmark/a.js`,
        `lib/${entry.slug}/localization/LocProject.json`, `lib/${entry.slug}/private.json`,
        `lib/${entry.slug}/index.ts`]) assert.equal(allowedFile(file, entry), false, file);
    for (const documented of PACKAGES.slice(1)) assert.equal(allowedFile("ARCHITECTURE.md", documented), true);
});

test("every supported locale preserves message coverage, comments and placeholder names", () => {
    const root = path.resolve(__dirname, "..", "..");
    const localeSource = fs.readFileSync(path.join(root, "packages", "powerquery-parser",
        "src", "localization", "locale.ts"), "utf8");
    const locales = [...localeSource.matchAll(/^\s+\w+ = "([^"]+)",$/gm)].map((match) => match[1]);
    assert.ok(locales.length > 1 && locales.includes("fr-FR"));
    const placeholders = (message) => [...new Set([...message.matchAll(/\{([^}]+)\}/g)]
        .map((match) => match[1]))].sort();
    for (const entry of PACKAGES.filter((item) => item.slug !== "powerquery-formatter")) {
        const workspace = path.join(root, entry.workspace);
        const files = localizationFiles(workspace, entry.slug);
        const bundleFiles = files.filter((file) => file.relative.startsWith("localization/bundles/"));
        assert.deepEqual(bundleFiles.map((file) => file.relative).sort(), locales.map((locale) =>
            `localization/bundles/bundle.l10n${locale === "en-US" ? "" : `.${locale}`}.json`).sort());
        const stem = entry.slug === "powerquery-parser" ? "template" : "templates";
        const defaults = JSON.parse(fs.readFileSync(path.join(workspace, "src", "localization",
            "templates", `${stem}.json`), "utf8"));
        const ids = Object.keys(defaults).filter((key) => !key.startsWith("_"));
        const messages = ids.map((key) => defaults[key]).sort();
        const english = bundleFiles.find((file) => file.relative.endsWith("/bundle.l10n.json")).contents;
        for (const id of ids) {
            assert.equal(english[defaults[id]].message, defaults[id]);
            assert.deepEqual(english[defaults[id]].comment, [defaults[`_${id}.comment`] ?? defaults[`_${id}`]]);
        }
        for (const file of bundleFiles) {
            assert.deepEqual(Object.keys(file.contents).sort(), messages, file.relative);
            for (const [message, translation] of Object.entries(file.contents)) {
                const text = typeof translation === "string" ? translation : translation.message;
                assert.equal(typeof text, "string", file.relative);
                assert.deepEqual(placeholders(text), placeholders(message), `${file.relative}: ${message}`);
                if (entry.slug === "powerquery-language-services" &&
                    !file.relative.endsWith("/bundle.l10n.json") && text === message) {
                    // "Type" is also the native word in these locales, not untranslated prose.
                    assert.equal(message, "Type: `{type}`", file.relative);
                    assert.ok(["da-DK", "nb-NO", "nl-NL"].some((locale) =>
                        file.relative.endsWith(`.${locale}.json`)), file.relative);
                }
            }
        }
    }
});

test("active legacy localization targets match the l10n bundles and placeholders", () => {
    const root = path.resolve(__dirname, "..", "..");
    const placeholders = (message) => [...new Set([...message.matchAll(/\{([^}]+)\}/g)]
        .map((match) => match[1]))].sort();
    for (const entry of PACKAGES.filter((item) => item.slug !== "powerquery-formatter")) {
        const localization = path.join(root, entry.workspace, "src", "localization");
        const stem = entry.slug === "powerquery-parser" ? "template" : "templates";
        for (const locale of fs.readdirSync(path.join(localization, "loc"))) {
            const bundle = JSON.parse(fs.readFileSync(path.join(localization, "bundles",
                `bundle.l10n.${locale}.json`), "utf8"));
            const xml = fs.readFileSync(path.join(localization, "loc", locale, "templates", `${stem}.json.lcl`), "utf8");
            // LCX uses CDATA; compare active Val/Tgt pairs, not historical Prev values.
            const values = [...xml.matchAll(
                /<Str\b[^>]*>\s*<Val><!\[CDATA\[([\s\S]*?)\]\]><\/Val>\s*<Tgt\b[^>]*>\s*<Val><!\[CDATA\[([\s\S]*?)\]\]><\/Val>/g)];
            assert.ok(values.length > 0, `${entry.slug}/${locale}`);
            for (const [, source, target] of values) {
                if (!Object.hasOwn(bundle, source)) continue;
                assert.equal(bundle[source], target, `${entry.slug}/${locale}: ${source}`);
                assert.deepEqual(placeholders(target), placeholders(source), `${entry.slug}/${locale}: ${source}`);
            }
        }
    }
});

test("pack requires every production module's JavaScript and declaration output", (context) => {
    const directory = fixture(context);
    const entry = PACKAGES[0];
    const workspace = path.join(directory, entry.workspace);
    const source = path.join(workspace, "src", "deep");
    const output = path.join(workspace, "lib", entry.slug, "deep");
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(source, "module.ts"), "export const value = 1;");
    assert.throws(() => requireBuiltOutputs(directory, entry), /missing build output/);
    fs.writeFileSync(path.join(output, "module.js"), "exports.value = 1;");
    assert.throws(() => requireBuiltOutputs(directory, entry), /module.d.ts/);
    fs.writeFileSync(path.join(output, "module.d.ts"), "export declare const value = 1;");
    requireBuiltOutputs(directory, entry);
});

test("required outputs fail when JS, declarations, README or license are missing/empty", () => {
    const entry = PACKAGES[0];
    const full = new Map([entry.main, entry.types, "README.md", "LICENSE", "package.json"].map((file) => [file, Buffer.from("data")]));
    requireOutputs(full, entry);
    for (const file of full.keys()) {
        const missing = new Map(full);
        missing.delete(file);
        assert.throws(() => requireOutputs(missing, entry), /missing required output/);
        missing.set(file, Buffer.alloc(0));
        assert.throws(() => requireOutputs(missing, entry), /missing required output/);
    }
});

test("manifest validates order, closure, schema, tags, paths and actual integrity", (context) => {
    const directory = fixture(context);
    const original = createManifest(directory);
    validateManifest(original, directory);
    for (const mutate of [
        (value) => { value.schemaVersion = 2; },
        (value) => { value.auth = "unexpected"; },
        (value) => { value.releaseVersion = "v5.0.0"; },
        (value) => { value.sourceCommit = "HEAD"; },
        (value) => { value.packages.reverse(); },
        (value) => { value.packages.pop(); },
        (value) => { value.packages[0].version = "4.0.0"; },
        (value) => { value.packages[0].distTag = "next"; },
        (value) => { value.packages[0].registry = "unexpected"; },
        (value) => { value.packages[0].workspace = "../secret"; },
        (value) => { value.packages[0].tarball = "../secret.tgz"; },
        (value) => { value.packages[1].internalDependencies[PACKAGES[0].name] = "^5.0.0"; },
        (value) => { value.packages[2].internalDependencies = {}; },
        (value) => { value.packages[0].integrity = integrity(Buffer.from("tampered")); },
        (value) => { value.packages[0].integrity = "sha256-invalid"; },
    ]) {
        const changed = clone(original);
        mutate(changed);
        assert.throws(() => validateManifest(changed, directory));
    }
    const filename = path.join(directory, original.packages[0].tarball);
    fs.writeFileSync(filename, "tampered");
    assert.throws(() => validateManifest(original, directory), /Integrity mismatch/);
    fs.rmSync(filename);
    assert.throws(() => validateManifest(original, directory), /Missing tarball/);
});

test("manifest refuses stale extra tarballs", (context) => {
    const directory = fixture(context);
    const manifest = createManifest(directory);
    fs.writeFileSync(path.join(directory, "npm", PACKAGES[0].slug, "stale.tgz"), "stale");
    assert.throws(() => validateManifest(manifest, directory), /exactly one tarball/);
});

test("manifest refuses unexpected output files and package directories", (context) => {
    const directory = fixture(context);
    const manifest = createManifest(directory);
    const extra = path.join(directory, "npm", "unexpected");
    fs.mkdirSync(extra);
    assert.throws(() => validateManifest(manifest, directory), /unexpected package directories/);
    fs.rmdirSync(extra);
    fs.writeFileSync(path.join(directory, ".npmrc"), "unexpected");
    assert.throws(() => validateManifest(manifest, directory), /unexpected files/);
});

test("inspects real tar contents rather than trusting pack filenames", async (context) => {
    const directory = fixture(context);
    const entry = PACKAGES[0];
    const filename = await createTar(directory, entry);
    assert.equal((await inspectTarball(filename, entry, VERSION)).name, entry.name);
});

for (const [label, options, expected] of [
    ["missing declarations", { omit: PACKAGES[0].types }, /missing required output/],
    ["private npm config", { files: { ".npmrc": "//registry.invalid/:_authToken=SECRET" } }, /development\/private file/],
    ["development tests", { files: { [`lib/${PACKAGES[0].slug}/test/private.js`]: "bad" } }, /unexpected directory|development\/private file/],
    ["incorrect tar version", { metadata: packageMetadata(PACKAGES[0], "4.0.0") }, /release version/],
    ["lifecycle hook", { metadata: { ...packageMetadata(PACKAGES[0]), scripts: { prepublishOnly: "exit 1" } } }, /lifecycle scripts/],
]) {
    test(`tar rejects ${label}`, async (context) => {
        const directory = fixture(context);
        const filename = await createTar(directory, PACKAGES[0], options);
        await assert.rejects(inspectTarball(filename, PACKAGES[0], VERSION), expected);
    });
}

test("tar refuses symbolic links and traversal even without extraction", async (context) => {
    const directory = fixture(context);
    for (const [type, name] of [["SymbolicLink", "package/link"], ["File", "package/../outside"]]) {
        const header = new tar.Header({
            path: name, type, mode: 0o644, size: 0,
            ...(type === "SymbolicLink" ? { linkpath: "../outside" } : {}),
        });
        header.encode();
        const filename = path.join(directory, "unsafe.tgz");
        fs.writeFileSync(filename, zlib.gzipSync(Buffer.concat([header.block, Buffer.alloc(1024)])));
        await assert.rejects(inspectTarball(filename, PACKAGES[0], VERSION), /Unsafe tar entry type|Unsafe relative path/);
    }
});

for (const [label, files, expected] of [
    ["missing", {}, /omits localization/],
    ["stale", {
        [`lib/${PACKAGES[0].slug}/localization/bundles/bundle.l10n.json`]: "{}",
        [`lib/${PACKAGES[0].slug}/localization/bundles/bundle.l10n.fr-FR.json`]: "{}",
    }, /localization content differs/],
]) {
    test(`tar rejects ${label} runtime localizations against baseline source content`, async (context) => {
        const directory = fixture(context);
        createRepository(directory);
        const source = path.join(directory, PACKAGES[0].workspace, "src", "localization", "templates");
        fs.mkdirSync(source, { recursive: true });
        fs.writeFileSync(path.join(source, "template.json"), '{"message":"English"}');
        const bundles = path.join(path.dirname(source), "bundles");
        fs.mkdirSync(bundles);
        fs.writeFileSync(path.join(bundles, "bundle.l10n.json"), '{"English":"English"}');
        fs.writeFileSync(path.join(bundles, "bundle.l10n.fr-FR.json"), '{"English":"French"}');
        const filename = await createTar(directory, PACKAGES[0], { files });
        await assert.rejects(inspectTarball(filename, PACKAGES[0], VERSION, directory), expected);
    });
}

test("valid manifest hashes cannot bypass tar metadata validation", async (context) => {
    const root = fixture(context);
    const directory = path.join(root, "dist");
    fs.mkdirSync(directory);
    const manifest = createManifest(directory);
    for (const [index, item] of manifest.packages.entries()) {
        const scratch = path.join(root, `archive-${index}`);
        fs.mkdirSync(scratch);
        const metadata = packageMetadata(PACKAGES[index]);
        if (index === 2) delete metadata.dependencies[PACKAGES[1].name];
        const filename = await createTar(scratch, PACKAGES[index], { metadata });
        const destination = path.join(directory, item.tarball);
        fs.copyFileSync(filename, destination);
        item.integrity = integrity(fs.readFileSync(destination));
    }
    validateManifest(manifest, directory);
    await assert.rejects(verifyManifest(manifest, directory), /closure/);
});

test("consumer preserves configured npm proxy settings but suppresses module injection", () => {
    const previous = { ...process.env };
    try {
        process.env.NPM_CONFIG_USERCONFIG = "private.npmrc";
        process.env.NPM_CONFIG_REGISTRY = "https://private.invalid";
        process.env.NPM_TOKEN = "secret";
        process.env.NODE_PATH = "workspace/node_modules";
        process.env.NODE_OPTIONS = "--require evil.js";
        const env = cleanEnvironment("consumer");
        assert.equal(env.NPM_TOKEN, "secret");
        assert.equal(env.NODE_PATH, "");
        assert.equal(env.NODE_OPTIONS, "");
        assert.equal(env.NPM_CONFIG_REGISTRY, "https://private.invalid");
        assert.equal(env.NPM_CONFIG_USERCONFIG, "private.npmrc");
    } finally {
        for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
        Object.assign(process.env, previous);
    }
});

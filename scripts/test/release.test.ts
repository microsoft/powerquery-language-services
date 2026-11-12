import test, { TestContext } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as tar from "tar";
import {
    PACKAGES,
    versionTag,
    validatePackage,
    validateLock,
    setVersion,
    bumpPatch,
    writeJson,
    loadRelease,
    findNpmCli,
    rollChangelog,
    prepareRelease,
    main,
    npm,
    PackageEntry,
    PackageMetadata,
    PackageLock,
    RootMetadata,
    Execute,
    readJson,
} from "../release";
import {
    safeRelative,
    inside,
    integrity,
    allowedFile,
    requireOutputs,
    requireBuiltOutputs,
    inspectTarball,
    validateManifest,
    verifyManifest,
    ReleaseManifest,
} from "../release-artifacts";
import { cleanEnvironment, validateInstalledPackages } from "../release-consumer";

const VERSION = "5.0.0";
const versions = (version = VERSION) => Object.fromEntries(PACKAGES.map(entry => [entry.name, version]));
const clone = <T>(value: T): T => structuredClone(value);

function packageMetadata(entry: PackageEntry, version = VERSION): PackageMetadata {
    return {
        name: entry.name,
        version,
        main: entry.main,
        types: entry.types,
        dependencies: Object.fromEntries(entry.dependencies.map(name => [name, version])),
        publishConfig: { access: "public", tag: versionTag(version) },
    };
}

function repository() {
    const root: RootMetadata = {
        name: "powerquery-workspace",
        version: "1.0.0",
        private: true,
        workspaces: PACKAGES.map(entry => entry.workspace),
        devDependencies: { typescript: "^5.9.2" },
    };
    const metadata = PACKAGES.map(entry => packageMetadata(entry));
    const lock: PackageLock = {
        name: root.name,
        version: root.version,
        lockfileVersion: 3,
        packages: { "": clone(root) },
    };
    PACKAGES.forEach((entry, index) => {
        lock.packages[entry.workspace] = clone(metadata[index]);
        lock.packages[`node_modules/${entry.name}`] = { resolved: entry.workspace, link: true };
    });
    return { root, metadata, lock };
}

function fixture(context: TestContext): string {
    const directory = fs.mkdtempSync(path.join(__dirname, "release-fixture-"));
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function createRepository(directory: string) {
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

function createManifest(directory: string): ReleaseManifest {
    return {
        schemaVersion: 1,
        releaseVersion: VERSION,
        sourceCommit: "a".repeat(40),
        packages: PACKAGES.map(entry => {
            const relative = `npm/${entry.slug}/${entry.slug}-5.0.0.tgz`;
            const filename = path.join(directory, relative);
            fs.mkdirSync(path.dirname(filename), { recursive: true });
            fs.writeFileSync(filename, entry.name);
            return {
                name: entry.name,
                version: VERSION,
                workspace: entry.workspace,
                tarball: relative,
                integrity: integrity(fs.readFileSync(filename)),
                internalDependencies: packageMetadata(entry).dependencies,
                distTag: "latest",
            };
        }),
    };
}

interface TarOptions {
    metadata?: PackageMetadata;
    files?: Record<string, string>;
    omit?: string;
}

async function createTar(directory: string, entry: PackageEntry, options: TarOptions = {}): Promise<string> {
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
    for (const version of [
        undefined,
        null,
        5,
        "",
        "v5.0.0",
        "=5.0.0",
        "5",
        "5.0",
        "05.0.0",
        "5.01.0",
        "5.0.01",
        "5.0.0-01",
        "5.0.0-",
        "5.0.0+",
        "5.0.0-a..b",
        "^5.0.0",
        " 5.0.0",
        "5.0.0\n",
    ]) {
        assert.throws(() => versionTag(version), /strict full SemVer/);
    }
});

test("npm selection honors the invoking npm and PATH before Node's bundled npm", context => {
    const directory = fixture(context);
    const global = path.join(directory, "global");
    const bundled = path.join(directory, "bundled");
    const makeCli = (base: string): string => {
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

test("enforces public names, entrypoints, package versions, dist tags and exact graph", () => {
    PACKAGES.forEach(entry => validatePackage(packageMetadata(entry), entry, versions()));
    const entry = PACKAGES[2];
    for (const mutate of [
        item => {
            item.name = "unscoped";
        },
        item => {
            item.private = true;
        },
        item => {
            item.main = "src/index.ts";
        },
        item => {
            item.types = "missing.d.ts";
        },
        item => {
            item.version = "4.0.0";
        },
        item => {
            item.publishConfig.tag = "next";
        },
        item => {
            item.publishConfig.registry = "https://private.invalid";
        },
        item => {
            delete item.dependencies[PACKAGES[0].name];
        },
        item => {
            item.dependencies[PACKAGES[1].name] = "^5.0.0";
        },
        item => {
            item.devDependencies = { [PACKAGES[0].name]: VERSION };
        },
        item => {
            item.optionalDependencies = { "@microsoft/powerquery-secret": VERSION };
        },
        item => {
            item.peerDependencies = { [PACKAGES[1].name]: VERSION };
        },
    ] satisfies ((item: PackageMetadata) => void)[]) {
        const item = packageMetadata(entry);
        mutate(item);
        assert.throws(() => validatePackage(item, entry, versions()));
    }
    const parser = packageMetadata(PACKAGES[0]);
    parser.dependencies[PACKAGES[1].name] = VERSION;
    assert.throws(() => validatePackage(parser, PACKAGES[0], versions()), /closure/);
});

test("validates lockfile root and workspace metadata and forbids registry duplicates", () => {
    const baseline = repository();
    validateLock(baseline.root, baseline.metadata, baseline.lock);
    for (const mutate of [
        lock => {
            lock.lockfileVersion = 2;
        },
        lock => {
            lock.version = "2.0.0";
        },
        lock => {
            lock.packages[""].workspaces?.reverse();
        },
        lock => {
            lock.packages[""].devDependencies = { typescript: "1.0.0" };
        },
        lock => {
            lock.packages[PACKAGES[0].workspace].version = "4.0.0";
        },
        lock => {
            delete lock.packages[PACKAGES[2].workspace].dependencies?.[PACKAGES[1].name];
        },
        lock => {
            lock.packages[`node_modules/${PACKAGES[0].name}`].resolved = "https://registry.npmjs.org/parser.tgz";
        },
        lock => {
            delete lock.packages[`node_modules/${PACKAGES[1].name}`].link;
        },
        lock => {
            lock.packages[`${PACKAGES[2].workspace}/node_modules/${PACKAGES[0].name}`] = { version: VERSION };
        },
    ] satisfies ((lock: PackageLock) => void)[]) {
        const lock = clone(baseline.lock);
        mutate(lock);
        assert.throws(() => validateLock(baseline.root, baseline.metadata, lock));
    }
});

test("rejects private roots and extra/reordered workspaces", context => {
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

test("rejects installed registry copies instead of local workspace resolution", context => {
    const directory = fixture(context);
    createRepository(directory);
    fs.mkdirSync(path.join(directory, "node_modules", PACKAGES[0].name), { recursive: true });
    assert.throws(() => loadRelease(directory), /resolves outside its local workspace/);
});

test("version updates all three versions/edges/tags and refreshes the lock once", context => {
    const directory = fixture(context);
    const data = createRepository(directory);
    let calls = 0;
    setVersion("5.1.0-rc.1+build.4", directory, () => {
        calls++;
        PACKAGES.forEach(entry => {
            data.lock.packages[entry.workspace] = readJson<PackageMetadata>(
                path.join(directory, entry.workspace, "package.json"),
            );
        });
        writeJson(path.join(directory, "package-lock.json"), data.lock);
    });
    assert.equal(calls, 1);
    const release = loadRelease(directory, { resolution: false });
    assert.deepEqual(release.versions, versions("5.1.0-rc.1+build.4"));
    for (const item of release.metadata) assert.equal(item.publishConfig.tag, "next");
});

test("patch increments the shared version and exact edges through reviewed preparation", context => {
    const directory = fixture(context);
    const data = createRepository(directory);
    let calls = 0;
    const next = bumpPatch(directory, () => {
        calls++;
        for (const entry of PACKAGES) {
            data.lock.packages[entry.workspace] = readJson<PackageMetadata>(
                path.join(directory, entry.workspace, "package.json"),
            );
        }
        writeJson(path.join(directory, "package-lock.json"), data.lock);
    });
    assert.equal(next, "5.0.1");
    assert.equal(calls, 1);
    const release = loadRelease(directory, { resolution: false });
    assert.deepEqual(release.versions, versions(next));
    for (const [index, metadata] of release.metadata.entries()) {
        assert.equal(metadata.publishConfig.tag, "latest");
        for (const name of PACKAGES[index].dependencies) assert.equal(metadata.dependencies[name], next);
    }
});

test("patch rejects inconsistent versions without changing manifests", context => {
    const directory = fixture(context);
    createRepository(directory);
    const file = path.join(directory, PACKAGES[1].workspace, "package.json");
    const metadata = readJson<PackageMetadata>(file);
    metadata.version = "6.0.0";
    writeJson(file, metadata);
    const before = fs.readFileSync(file);
    assert.throws(
        () =>
            bumpPatch(directory, () => {
                throw new Error("Must not refresh");
            }),
        /closure/,
    );
    assert.deepEqual(fs.readFileSync(file), before);
});

test("failed lock refresh or stale successful lock rolls back original bytes", context => {
    const directory = fixture(context);
    createRepository(directory);
    const paths = [
        ...PACKAGES.map(entry => path.join(directory, entry.workspace, "package.json")),
        path.join(directory, "package-lock.json"),
    ];
    const bytes = paths.map(filename => fs.readFileSync(filename));
    for (const refresh of [
        () => {
            fs.writeFileSync(paths[3], "broken lock");
            throw new Error("npm failed");
        },
        () => {},
    ]) {
        assert.throws(() => setVersion("6.0.0", directory, refresh), /rolled back/);
        paths.forEach((filename, index) => assert.deepEqual(fs.readFileSync(filename), bytes[index]));
    }
});

test("failed refresh removes a newly created lockfile if none existed", context => {
    const directory = fixture(context);
    createRepository(directory);
    const lock = path.join(directory, "package-lock.json");
    fs.rmSync(lock);
    assert.throws(
        () =>
            setVersion("6.0.0", directory, () => {
                fs.writeFileSync(lock, "{}");
                throw new Error("refresh failure");
            }),
        /rolled back/,
    );
    assert.equal(fs.existsSync(lock), false);
});

test("paths reject traversal, absolutes, drive paths, backslashes and control characters", context => {
    const directory = fixture(context);
    assert.equal(safeRelative("npm/parser/a.tgz"), "npm/parser/a.tgz");
    assert.equal(inside(directory, "npm/parser/a.tgz"), path.join(directory, "npm", "parser", "a.tgz"));
    for (const value of [
        "",
        null,
        "/absolute",
        "../outside",
        "a/../b",
        "./a",
        "a//b",
        "C:/secret",
        "a\\b",
        "a/\0b",
        "a/\nb",
        "a/",
        "a/.. /b",
        "a/con.tgz",
        "a/foo.",
        "a/foo ",
        "a/*.tgz",
    ]) {
        assert.throws(() => safeRelative(value), /Unsafe relative path/);
        assert.throws(() => inside(directory, value), /Unsafe relative path/);
    }
});

test("output paths reject directory symlinks/junctions", context => {
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
    for (const file of [
        entry.main,
        entry.types,
        `${entry.main}.map`,
        "README.md",
        "CHANGELOG.md",
        "LICENSE",
        "NOTICE.txt",
        `lib/${entry.slug}/localization/templates/template.fr-FR.json`,
    ])
        assert.equal(allowedFile(file, entry), true, file);
    for (const file of [
        ".npmrc",
        "package-lock.json",
        "tsconfig.tsbuildinfo",
        "src/index.ts",
        "ARCHITECTURE.md",
        `lib/${entry.slug}/test/a.js`,
        "lib/test/a.js",
        `lib/${entry.slug}/benchmark/a.js`,
        `lib/${entry.slug}/localization/LocProject.json`,
        `lib/${entry.slug}/private.json`,
        `lib/${entry.slug}/index.ts`,
    ])
        assert.equal(allowedFile(file, entry), false, file);
    for (const documented of PACKAGES.slice(1)) assert.equal(allowedFile("ARCHITECTURE.md", documented), true);
});

test("pack requires every production module's JavaScript and declaration output", context => {
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
    const full = new Map(
        [entry.main, entry.types, "README.md", "LICENSE", "package.json"].map(file => [file, Buffer.from("data")]),
    );
    requireOutputs(full, entry);
    for (const file of full.keys()) {
        const missing = new Map(full);
        missing.delete(file);
        assert.throws(() => requireOutputs(missing, entry), /missing required output/);
        missing.set(file, Buffer.alloc(0));
        assert.throws(() => requireOutputs(missing, entry), /missing required output/);
    }
});

test("manifest validates order, closure, schema, tags, paths and actual integrity", context => {
    const directory = fixture(context);
    const original = createManifest(directory);
    validateManifest(original, directory);
    for (const mutate of [
        value => {
            value.schemaVersion = 3;
        },
        value => {
            Object.assign(value, { auth: "unexpected" });
        },
        value => {
            value.releaseVersion = "v5.0.0";
        },
        value => {
            value.sourceCommit = "HEAD";
        },
        value => {
            value.packages.reverse();
        },
        value => {
            value.packages.pop();
        },
        value => {
            value.packages[0].version = "4.0.0";
        },
        value => {
            value.packages[0].distTag = "next";
        },
        value => {
            Object.assign(value.packages[0], { registry: "unexpected" });
        },
        value => {
            value.packages[0].workspace = "../secret";
        },
        value => {
            value.packages[0].tarball = "../secret.tgz";
        },
        value => {
            value.packages[1].internalDependencies[PACKAGES[0].name] = "^5.0.0";
        },
        value => {
            value.packages[2].internalDependencies = {};
        },
        value => {
            value.packages[0].integrity = integrity(Buffer.from("tampered"));
        },
        value => {
            value.packages[0].integrity = "sha256-invalid";
        },
    ] satisfies ((value: ReleaseManifest) => void)[]) {
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

test("manifest refuses stale extra tarballs", context => {
    const directory = fixture(context);
    const manifest = createManifest(directory);
    fs.writeFileSync(path.join(directory, "npm", PACKAGES[0].slug, "stale.tgz"), "stale");
    assert.throws(() => validateManifest(manifest, directory), /exactly one tarball/);
});

test("manifest refuses unexpected output files and package directories", context => {
    const directory = fixture(context);
    const manifest = createManifest(directory);
    const extra = path.join(directory, "npm", "unexpected");
    fs.mkdirSync(extra);
    assert.throws(() => validateManifest(manifest, directory), /unexpected package directories/);
    fs.rmdirSync(extra);
    fs.writeFileSync(path.join(directory, ".npmrc"), "unexpected");
    assert.throws(() => validateManifest(manifest, directory), /unexpected files/);
});

test("inspects real tar contents rather than trusting pack filenames", async context => {
    const directory = fixture(context);
    const entry = PACKAGES[0];
    const filename = await createTar(directory, entry);
    assert.equal((await inspectTarball(filename, entry, versions())).name, entry.name);
});

for (const [label, options, expected] of [
    ["missing declarations", { omit: PACKAGES[0].types }, /missing required output/],
    [
        "private npm config",
        { files: { ".npmrc": "//registry.invalid/:_authToken=SECRET" } },
        /development\/private file/,
    ],
    [
        "development tests",
        { files: { [`lib/${PACKAGES[0].slug}/test/private.js`]: "bad" } },
        /unexpected directory|development\/private file/,
    ],
    ["incorrect tar version", { metadata: packageMetadata(PACKAGES[0], "4.0.0") }, /release version/],
    [
        "lifecycle hook",
        { metadata: { ...packageMetadata(PACKAGES[0]), scripts: { prepublishOnly: "exit 1" } } },
        /lifecycle scripts/,
    ],
] satisfies [string, TarOptions, RegExp][]) {
    test(`tar rejects ${label}`, async context => {
        const directory = fixture(context);
        const filename = await createTar(directory, PACKAGES[0], options);
        await assert.rejects(inspectTarball(filename, PACKAGES[0], versions()), expected);
    });
}

test("tar refuses symbolic links and traversal even without extraction", async context => {
    const directory = fixture(context);
    for (const [type, name] of [
        ["SymbolicLink", "package/link"],
        ["File", "package/../outside"],
    ] as const) {
        const header = new tar.Header({
            path: name,
            type,
            mode: 0o644,
            size: 0,
            ...(type === "SymbolicLink" ? { linkpath: "../outside" } : {}),
        });
        header.encode();
        const filename = path.join(directory, "unsafe.tgz");
        assert.ok(header.block);
        fs.writeFileSync(filename, zlib.gzipSync(Buffer.concat([header.block, Buffer.alloc(1024)])));
        await assert.rejects(
            inspectTarball(filename, PACKAGES[0], versions()),
            /Unsafe tar entry type|Unsafe relative path/,
        );
    }
});

for (const [label, files, expected] of [
    ["missing", {}, /omits localization/],
    [
        "stale",
        {
            [`lib/${PACKAGES[0].slug}/localization/templates/template.json`]: "{}",
            [`lib/${PACKAGES[0].slug}/localization/templates/template.fr-FR.json`]: "{}",
        },
        /localization content differs/,
    ],
] satisfies [string, Record<string, string>, RegExp][]) {
    test(`tar rejects ${label} runtime localizations against baseline source content`, async context => {
        const directory = fixture(context);
        createRepository(directory);
        const source = path.join(directory, PACKAGES[0].workspace, "src", "localization", "templates");
        fs.mkdirSync(source, { recursive: true });
        fs.writeFileSync(path.join(source, "template.json"), '{"message":"English"}');
        fs.writeFileSync(path.join(source, "template.fr-FR.json"), '{"message":"French"}');
        const filename = await createTar(directory, PACKAGES[0], { files });
        await assert.rejects(inspectTarball(filename, PACKAGES[0], versions(), directory), expected);
    });
}

test("valid manifest hashes cannot bypass tar metadata validation", async context => {
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
        const env = cleanEnvironment();
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

function preparationFixture(context: TestContext, initialVersions = versions()): string {
    const directory = fixture(context);
    const data = createRepository(directory);
    PACKAGES.forEach(entry => {
        const metadata = packageMetadata(entry, initialVersions[entry.name]);
        metadata.dependencies = Object.fromEntries(entry.dependencies.map(name => [name, initialVersions[name]]));
        writeJson(path.join(directory, entry.workspace, "package.json"), metadata);
        data.lock.packages[entry.workspace] = clone(metadata);
        fs.writeFileSync(
            path.join(directory, entry.workspace, "CHANGELOG.md"),
            "# Changelog\r\n\r\n## Unreleased\r\n\r\n### Fixes\r\n\r\n- Fixed: Keep comments.\r\n\r\n" +
                "```markdown\r\n## Unreleased\r\n## 6.0.0\r\n```\r\n\r\n## 4.0.0\r\n\r\n- Added: Earlier behavior.\r\n",
        );
    });
    writeJson(path.join(directory, "package-lock.json"), data.lock);
    return directory;
}

function releaseBytes(directory: string): Map<string, Buffer> {
    return new Map(
        [
            "package.json",
            "package-lock.json",
            ...PACKAGES.flatMap(entry => [`${entry.workspace}/package.json`, `${entry.workspace}/CHANGELOG.md`]),
        ].map(relative => [relative, fs.readFileSync(path.join(directory, relative))]),
    );
}

function assertReleaseBytes(directory: string, expected: ReadonlyMap<string, Buffer>): void {
    for (const [relative, bytes] of expected)
        assert.deepEqual(fs.readFileSync(path.join(directory, relative)), bytes, relative);
}

function refreshFixtureLock(directory: string): void {
    const lockfile = path.join(directory, "package-lock.json");
    const lock = readJson<PackageLock>(lockfile);
    for (const entry of PACKAGES) {
        const metadata = readJson<PackageMetadata>(path.join(directory, entry.workspace, "package.json"));
        lock.packages[entry.workspace].version = metadata.version;
        lock.packages[entry.workspace].dependencies = metadata.dependencies;
    }
    writeJson(lockfile, lock);
}

function preparationOptions(
    root: string,
    execute: Execute = (args, options) => {
        if (args[0] === "install") refreshFixtureLock(options.cwd);
    },
) {
    return { root, resolution: false, execute, now: () => new Date("2026-11-12T23:15:00-06:00") };
}

for (const [projectIndex, increment, next] of [
    [0, "major", "6.0.0"],
    [1, "minor", "5.1.0"],
    [2, "patch", "5.0.1"],
] as const) {
    test(`prepares ${increment} for ${PACKAGES[projectIndex].slug} with only direct dependent pins`, context => {
        const directory = preparationFixture(context);
        const before = releaseBytes(directory);
        const selected = PACKAGES[projectIndex];
        const phases: string[] = [];
        const options = preparationOptions(directory, (args, commandOptions) => {
            if (args[0] === "install") {
                assert.notEqual(commandOptions.cwd, directory);
                refreshFixtureLock(commandOptions.cwd);
            } else {
                phases.push(args.join(" "));
                if (args.join(" ") !== "run validate:release") assertReleaseBytes(directory, before);
            }
        });
        const result = prepareRelease([projectIndex === 1 ? selected.name : selected.slug, increment], options);
        assert.deepEqual(phases, ["run lint", "run build", "test", "run validate:release"]);
        assert.equal(result.version, next);
        assert.equal(result.date, "2026-11-13");
        const release = loadRelease(directory, { resolution: false });
        assert.deepEqual(release.versions, { ...versions(), [selected.name]: next });
        PACKAGES.forEach((entry, index) => {
            for (const name of entry.dependencies) {
                assert.equal(release.metadata[index].dependencies[name], name === selected.name ? next : VERSION);
            }
            const relative = `${entry.workspace}/CHANGELOG.md`;
            const actual = fs.readFileSync(path.join(directory, relative));
            const original = before.get(relative);
            assert.ok(original);
            assert.deepEqual(
                actual,
                entry === selected
                    ? Buffer.from(original.toString().replace("## Unreleased", `## ${next} - 2026-11-13`))
                    : original,
            );
            if (index < projectIndex) {
                assert.deepEqual(
                    fs.readFileSync(path.join(directory, entry.workspace, "package.json")),
                    before.get(`${entry.workspace}/package.json`),
                );
            }
        });
        assert.deepEqual(fs.readFileSync(path.join(directory, "package.json")), before.get("package.json"));
        assert.equal(
            result.files.length,
            2 + PACKAGES.filter(entry => entry === selected || entry.dependencies.includes(selected.name)).length,
        );
    });
}

test("supports unequal versions and promotes prereleases following semver.inc", context => {
    const initial = {
        [PACKAGES[0].name]: "6.0.0-rc.2",
        [PACKAGES[1].name]: "4.2.0",
        [PACKAGES[2].name]: "3.1.0-beta.1",
    };
    const directory = preparationFixture(context, initial);
    const result = prepareRelease([PACKAGES[0].slug, "patch"], preparationOptions(directory));
    assert.equal(result.version, "6.0.0");
    const release = loadRelease(directory, { resolution: false });
    assert.deepEqual(release.versions, { ...initial, [PACKAGES[0].name]: "6.0.0" });
    assert.deepEqual(
        release.metadata.map(item => item.publishConfig.tag),
        ["latest", "latest", "next"],
    );
    assert.throws(() => bumpPatch(directory), /Legacy patch requires a shared release version/);
});

test("changelog rollup preserves nested sections, fenced headings, history and line endings", () => {
    for (const newline of ["\n", "\r\n"]) {
        const source = [
            "# Changelog",
            "",
            "## Unreleased",
            "",
            "### Added",
            "",
            "- Added: Public behavior.",
            "",
            "~~~~md",
            "## Unreleased",
            "## 5.1.0",
            "```",
            "~~~~",
            "",
            "## 5.0.0",
            "",
            "- Fixed: Old behavior.",
        ].join(newline);
        assert.equal(
            rollChangelog(source, "5.1.0", "2026-11-13"),
            source.replace("## Unreleased", "## 5.1.0 - 2026-11-13"),
        );
    }
    assert.equal(
        rollChangelog("## Unreleased ##\n\n- Fixed: Behavior.\n", "5.0.1", "2026-11-13"),
        "## 5.0.1 - 2026-11-13\n\n- Fixed: Behavior.\n",
    );
});

for (const [label, source] of [
    ["missing", "# Changelog\n\n## 5.0.0\n\n- Fixed: Old.\n"],
    ["empty", "## Unreleased\n\n## 5.0.0\n\n- Fixed: Old.\n"],
    ["only subsection headings", "## Unreleased\n\n### Fixed\n\n<!-- pending -->\n"],
    ["empty fence", "## Unreleased\n\n```\n```\n"],
    ["duplicate", "## Unreleased\n\n- Fixed: A.\n\n## Unreleased\n\n- Fixed: B.\n"],
    ["malformed", "##Unreleased\n\n- Fixed: A.\n"],
    ["ambiguous", "## Unreleased - pending\n\n- Fixed: A.\n"],
    ["case variant", "## unreleased\n\n- Fixed: A.\n"],
    ["setext", "Unreleased\n---\n\n- Fixed: A.\n"],
    ["duplicate release", "## Unreleased\n\n- Fixed: A.\n\n## 5.0.1 - 2026-11-12\n\n- Fixed: B.\n"],
    ["linked duplicate release", "## Unreleased\n\n- Fixed: A.\n\n## [5.0.1]\n\n- Fixed: B.\n"],
    ["setext duplicate release", "## Unreleased\n\n- Fixed: A.\n\n5.0.1\n---\n\n- Fixed: B.\n"],
    ["empty before setext history", "## Unreleased\n\n5.0.0\n---\n\n- Fixed: Old.\n"],
    ["tabbed duplicate release", "## Unreleased\n\n- Fixed: A.\n\n## 5.0.1\t- 2026-11-12\n"],
    ["linked duplicate URL", "## Unreleased\n\n- Fixed: A.\n\n## [5.0.1](https://example.invalid/release)\n"],
]) {
    test(`rejects ${label} changelog without writes or commands`, context => {
        const directory = preparationFixture(context);
        fs.writeFileSync(path.join(directory, PACKAGES[0].workspace, "CHANGELOG.md"), source);
        const before = releaseBytes(directory);
        assert.throws(() =>
            prepareRelease(
                [PACKAGES[0].slug, "patch"],
                preparationOptions(directory, () => assert.fail("Invalid changelog must not launch commands")),
            ),
        );
        assertReleaseBytes(directory, before);
    });
}

test("rejects invalid arguments before reading files or running commands", async context => {
    const directory = fixture(context);
    for (const args of [
        [],
        [PACKAGES[0].slug],
        ["unknown", "patch"],
        ["../powerquery-parser", "patch"],
        [PACKAGES[0].slug, "prerelease"],
        [PACKAGES[0].slug, "PATCH"],
        [PACKAGES[0].slug, "patch", "extra"],
    ]) {
        assert.throws(
            () =>
                prepareRelease(
                    args,
                    preparationOptions(directory, () => assert.fail("No commands")),
                ),
            /Expected exactly|Unknown release project|Invalid release increment/,
        );
        await assert.rejects(main(["prepare", ...args]), /Usage:|Unknown release project|Invalid release increment/);
    }
    assert.deepEqual(fs.readdirSync(directory), []);
});

test("preflight rejects invalid package and lock metadata without writes or commands", context => {
    const directory = preparationFixture(context);
    const originals = releaseBytes(directory);
    for (const relative of [`${PACKAGES[2].workspace}/package.json`, "package-lock.json"]) {
        fs.writeFileSync(path.join(directory, relative), "{}");
        const before = releaseBytes(directory);
        assert.throws(() =>
            prepareRelease(
                [PACKAGES[0].slug, "patch"],
                preparationOptions(directory, () => assert.fail("Invalid metadata must not launch commands")),
            ),
        );
        assertReleaseBytes(directory, before);
        const original = originals.get(relative);
        assert.ok(original);
        fs.writeFileSync(path.join(directory, relative), original);
    }
});

for (const failure of [
    "run lint",
    "run build",
    "test",
    "install",
    "stale lock",
    "unrelated lock",
    "run validate:release",
]) {
    test(`${failure} failure leaves release-source bytes unchanged`, context => {
        const directory = preparationFixture(context);
        const before = releaseBytes(directory);
        assert.throws(
            () =>
                prepareRelease(
                    [PACKAGES[0].slug, "patch"],
                    preparationOptions(directory, (args, options) => {
                        const phase = args[0] === "install" ? "install" : args.join(" ");
                        if (phase === failure) throw new Error(`Failed ${failure}`);
                        if (phase === "install" && failure !== "stale lock") {
                            refreshFixtureLock(options.cwd);
                            if (failure === "unrelated lock") {
                                const filename = path.join(options.cwd, "package-lock.json");
                                const lock = readJson<PackageLock>(filename);
                                lock.packages["node_modules/unrelated"] = { version: "2.0.0" };
                                writeJson(filename, lock);
                            }
                        }
                    }),
                ),
            /Failed|mismatch|unrelated/,
        );
        assertReleaseBytes(directory, before);
    });
}

for (const phase of ["run lint", "install", "run validate:release"]) {
    test(`preserves concurrent manifest edits during ${phase} and restores only owned bytes`, context => {
        const directory = preparationFixture(context);
        const before = releaseBytes(directory);
        const relative = `${PACKAGES[1].workspace}/package.json`;
        const filename = path.join(directory, relative);
        const concurrent = Buffer.from('{"name":"concurrent human edit"}\n');
        assert.throws(
            () =>
                prepareRelease(
                    [PACKAGES[0].slug, "patch"],
                    preparationOptions(directory, (args, options) => {
                        if (args[0] === "install") refreshFixtureLock(options.cwd);
                        if ((args[0] === "install" ? "install" : args.join(" ")) === phase)
                            fs.writeFileSync(filename, concurrent);
                    }),
                ),
            phase === "run lint" ? /Concurrent release-file edit/ : /rollback incomplete.*preserved concurrent edit/,
        );
        before.set(relative, concurrent);
        assertReleaseBytes(directory, before);
    });
}

test("preserves concurrent edits to the real lock while npm refreshes its isolated copy", context => {
    const directory = preparationFixture(context);
    const before = releaseBytes(directory);
    const concurrent = Buffer.from("human lock edit");
    assert.throws(
        () =>
            prepareRelease(
                [PACKAGES[0].slug, "patch"],
                preparationOptions(directory, (args, options) => {
                    if (args[0] !== "install") return;
                    refreshFixtureLock(options.cwd);
                    fs.writeFileSync(path.join(directory, "package-lock.json"), concurrent);
                }),
            ),
        /Concurrent release-file edit/,
    );
    before.set("package-lock.json", concurrent);
    assertReleaseBytes(directory, before);
});

test("detects unselected changelog edits during final validation without overwriting them", context => {
    const directory = preparationFixture(context);
    const before = releaseBytes(directory);
    const relative = `${PACKAGES[2].workspace}/CHANGELOG.md`;
    const concurrent = Buffer.from("# Human notes\n");
    assert.throws(
        () =>
            prepareRelease(
                [PACKAGES[0].slug, "patch"],
                preparationOptions(directory, (args, options) => {
                    if (args[0] === "install") refreshFixtureLock(options.cwd);
                    if (args.join(" ") === "run validate:release")
                        fs.writeFileSync(path.join(directory, relative), concurrent);
                }),
            ),
        /Concurrent release-file edit/,
    );
    before.set(relative, concurrent);
    assertReleaseBytes(directory, before);
});

test("schema v2 verifies unequal tar versions and exact referenced pins; v1 remains readable", async context => {
    const root = fixture(context);
    const dist = path.join(root, "dist");
    fs.mkdirSync(dist);
    const manifest = createManifest(dist);
    validateManifest(manifest, dist);
    manifest.schemaVersion = 2;
    delete manifest.releaseVersion;
    const selectedVersions = {
        [PACKAGES[0].name]: "6.0.0",
        [PACKAGES[1].name]: "4.2.0-rc.1",
        [PACKAGES[2].name]: "3.0.1",
    };
    for (const [index, item] of manifest.packages.entries()) {
        const metadata = packageMetadata(PACKAGES[index], selectedVersions[item.name]);
        metadata.dependencies = Object.fromEntries(
            PACKAGES[index].dependencies.map(name => [name, selectedVersions[name]]),
        );
        item.version = metadata.version;
        item.distTag = versionTag(item.version);
        item.internalDependencies = metadata.dependencies;
        const archive = path.join(root, `archive-${index}`);
        fs.mkdirSync(archive);
        const filename = await createTar(archive, PACKAGES[index], { metadata });
        fs.copyFileSync(filename, path.join(dist, item.tarball));
        item.integrity = integrity(fs.readFileSync(filename));
        const installed = path.join(root, "consumer", "node_modules", item.name);
        fs.mkdirSync(installed, { recursive: true });
        writeJson(path.join(installed, "package.json"), metadata);
    }
    await verifyManifest(manifest, dist);
    validateInstalledPackages(path.join(root, "consumer"), manifest);
    const wrongInstall = path.join(root, "consumer", "node_modules", PACKAGES[1].name, "package.json");
    writeJson(wrongInstall, packageMetadata(PACKAGES[1]));
    assert.throws(() => validateInstalledPackages(path.join(root, "consumer"), manifest), /wrong release/);
    for (const mutate of [
        value => {
            value.packages[1].internalDependencies[PACKAGES[0].name] = "4.2.0-rc.1";
        },
        value => {
            value.packages[1].distTag = "latest";
        },
        value => {
            value.schemaVersion = 1;
            value.releaseVersion = "6.0.0";
        },
        value => {
            value.schemaVersion = 7;
        },
    ] satisfies ((value: ReleaseManifest) => void)[]) {
        const invalid = clone(manifest);
        mutate(invalid);
        assert.throws(() => validateManifest(invalid, dist));
    }
});

test("rollup ignores commented headings and stops at older setext release sections", () => {
    const source =
        "# Changelog\n\n<!--\n## Unreleased\n## 5.0.1\n-->\n\n## Unreleased\n\n- Fixed: A.\n\n" +
        "5.0.0\n------\n\n- Fixed: Old.\n";
    assert.equal(
        rollChangelog(source, "5.0.1", "2026-11-13"),
        source.replace("## Unreleased\n\n- Fixed: A.", "## 5.0.1 - 2026-11-13\n\n- Fixed: A."),
    );
});

for (const [index, increment] of [
    [0, "major"],
    [1, "minor"],
    [2, "patch"],
] as const) {
    test(`real npm lock refresh accepts only scoped ${increment} changes in a disposable repository`, context => {
        const directory = fixture(context);
        const root = path.resolve(__dirname, "..", "..");
        for (const relative of [
            "package.json",
            "package-lock.json",
            ".npmrc",
            ...PACKAGES.map(entry => `${entry.workspace}/package.json`),
        ]) {
            const destination = path.join(directory, relative);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.copyFileSync(path.join(root, relative), destination);
        }
        fs.writeFileSync(
            path.join(directory, PACKAGES[index].workspace, "CHANGELOG.md"),
            "# Changelog\n\n## Unreleased\n\n- Fixed: Fixture-only release content.\n",
        );
        const before = loadRelease(directory, { resolution: false });
        const result = prepareRelease(
            [PACKAGES[index].slug, increment],
            preparationOptions(directory, (args, options) => {
                if (args[0] === "install") npm([...args, "--offline", "--no-audit", "--no-fund"], { cwd: options.cwd });
            }),
        );
        const after = loadRelease(directory, { resolution: false });
        assert.deepEqual(after.versions, { ...before.versions, [PACKAGES[index].name]: result.version });
    });
}

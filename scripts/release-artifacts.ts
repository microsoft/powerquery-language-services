import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as os from "node:os";
import * as tar from "tar";
import {
    PACKAGES,
    check,
    readJson,
    writeJson,
    same,
    versionTag,
    internalDependencies,
    validatePackage,
    loadRelease,
    run,
    npm,
    PackageEntry,
    PackageMetadata,
} from "./release";

export interface ManifestPackage {
    name: string;
    version: string;
    workspace: string;
    tarball: string;
    integrity: string;
    internalDependencies: Record<string, string>;
    distTag: string;
}

export interface ReleaseManifest {
    schemaVersion: number;
    releaseVersion: string;
    sourceCommit: string;
    packages: ManifestPackage[];
}

export function safeRelative(value: unknown): string {
    check(
        typeof value === "string" &&
            value.length > 0 &&
            !value.includes("\\") &&
            !/[<>:"|?*\0-\x1f\x7f]/.test(value) &&
            !value.startsWith("/") &&
            value
                .split("/")
                .every(
                    part =>
                        part &&
                        part !== "." &&
                        part !== ".." &&
                        !/[. ]$/.test(part) &&
                        part.trim() === part &&
                        !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
                ),
        `Unsafe relative path: ${String(value)}`,
    );
    return value;
}

export function inside(root: string, relative: unknown): string {
    const safe = safeRelative(relative);
    const filename = path.resolve(root, safe);
    check(filename.startsWith(`${path.resolve(root)}${path.sep}`), `Path escapes output directory: ${relative}`);
    if (fs.existsSync(root)) check(!fs.lstatSync(root).isSymbolicLink(), `Symlink output directory: ${root}`);
    let cursor = filename;
    while (cursor !== path.resolve(root)) {
        if (fs.existsSync(cursor)) check(!fs.lstatSync(cursor).isSymbolicLink(), `Symlink in output path: ${relative}`);
        cursor = path.dirname(cursor);
    }
    return filename;
}

export function integrity(bytes: Buffer): string {
    return `sha512-${crypto.createHash("sha512").update(bytes).digest("base64")}`;
}

function walk(root: string, prefix = ""): string[] {
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
        check(!entry.isSymbolicLink(), `Symlink in runtime source: ${path.join(root, entry.name)}`);
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        return entry.isDirectory() ? walk(path.join(root, entry.name), relative) : [relative];
    });
}

export function allowedFile(relative: string, entry: PackageEntry): boolean {
    safeRelative(relative);
    if (
        /^(package\.json|README(?:\.md)?|CHANGELOG\.md|LICENSE(?:\.txt|\.md)?|NOTICE(?:\.txt|\.md)?|specification\.md|style\.md)$/i.test(
            relative,
        )
    )
        return true;
    if (relative === "ARCHITECTURE.md" && entry.slug !== "powerquery-parser") return true;
    if (!relative.startsWith(`lib/${entry.slug}/`)) return false;
    if (
        relative
            .split("/")
            .some(part =>
                /^(?:test|tests|__tests__|benchmark|benchmarks|scripts|node_modules|coverage|\..*)$/i.test(part),
            )
    )
        return false;
    if (/\.(?:js|d\.ts)(?:\.map)?$/.test(relative)) return true;
    return new RegExp(`^lib/${entry.slug}/localization/templates/templates?(?:\\.[A-Za-z-]+)?\\.json$`).test(relative);
}

function localizationFiles(root: string, entry: PackageEntry): { relative: string; source: string }[] {
    const source = path.join(root, entry.workspace, "src", "localization", "templates");
    const files = walk(source).filter(file => file.endsWith(".json"));
    if (entry.slug !== "powerquery-formatter") {
        check(
            files.length > 1 &&
                files.some(file => /templates?\.json$/.test(file)) &&
                files.some(file => /\.fr-FR\.json$/.test(file)),
            `${entry.name} lacks baseline source localizations`,
        );
    }
    return files.map(file => ({
        relative: `lib/${entry.slug}/localization/templates/${file}`,
        source: path.join(source, file),
    }));
}

export function requireOutputs(files: ReadonlyMap<string, Buffer>, entry: PackageEntry): void {
    for (const required of [entry.main, entry.types, "package.json", "README.md", "LICENSE"]) {
        const bytes = files.get(required);
        check(bytes && bytes.length > 0, `${entry.name} missing required output ${required}`);
    }
    check(
        [...files.keys()].some(file => file.endsWith(".js")),
        `${entry.name} has no runtime JS`,
    );
}

export function requireBuiltOutputs(root: string, entry: PackageEntry): void {
    const workspace = path.join(root, entry.workspace);
    const source = path.join(workspace, "src");
    const modules = walk(source).filter(file => file.endsWith(".ts") && !file.endsWith(".d.ts"));
    check(modules.length > 0, `${entry.name} has no production TypeScript sources`);
    for (const file of modules) {
        const stem = `lib/${entry.slug}/${file.slice(0, -3)}`;
        for (const extension of [".js", ".d.ts"]) {
            const output = inside(workspace, `${stem}${extension}`);
            check(
                fs.existsSync(output) && fs.statSync(output).isFile() && fs.statSync(output).size > 0,
                `${entry.name} missing build output ${stem}${extension}; build first`,
            );
        }
    }
}

export async function inspectTarball(
    filename: string,
    entry: PackageEntry,
    version: string,
    root?: string,
): Promise<PackageMetadata> {
    const files = new Map<string, Buffer>();
    const normalizedPaths = new Set<string>();
    let failure: unknown;
    let totalBytes = 0;
    await tar.t({
        file: filename,
        strict: true,
        onReadEntry(record) {
            try {
                const relative = record.path.replace(/\/$/, "");
                safeRelative(relative);
                check(
                    relative === "package" || relative.startsWith("package/"),
                    `Tar entry must be under package/: ${record.path}`,
                );
                check(
                    record.type === "File" || record.type === "Directory",
                    `Unsafe tar entry type ${record.type}: ${record.path}`,
                );
                if (record.type === "Directory") {
                    const directory = relative.slice("package/".length);
                    check(
                        relative === "package" ||
                            directory === "lib" ||
                            directory === `lib/${entry.slug}` ||
                            (directory.startsWith(`lib/${entry.slug}/`) &&
                                !directory
                                    .split("/")
                                    .some(part =>
                                        /^(?:test|tests|__tests__|benchmark|benchmarks|scripts|node_modules|coverage|\..*)$/i.test(
                                            part,
                                        ),
                                    )),
                        `${entry.name} contains an unexpected directory: ${record.path}`,
                    );
                    return;
                }
                const file = relative.slice("package/".length);
                check(allowedFile(file, entry), `${entry.name} contains unexpected development/private file: ${file}`);
                check(!normalizedPaths.has(file.toLowerCase()), `Duplicate tar entry: ${file}`);
                normalizedPaths.add(file.toLowerCase());
                check(record.size <= 16 * 1024 * 1024, `Oversized tar entry: ${file}`);
                totalBytes += record.size;
                check(totalBytes <= 128 * 1024 * 1024 && files.size < 10000, "Tarball exceeds inspection limits");
                const chunks: Buffer[] = [];
                files.set(file, Buffer.alloc(0));
                record.on("data", (chunk: Buffer) => chunks.push(chunk));
                record.on("end", () => files.set(file, Buffer.concat(chunks)));
            } catch (error) {
                failure ??= error;
                record.resume();
            }
        },
    });
    if (failure) throw failure;
    requireOutputs(files, entry);
    const packageBytes = files.get("package.json");
    check(packageBytes, `${entry.name} missing package.json`);
    const metadata: PackageMetadata = JSON.parse(packageBytes.toString("utf8"));
    validatePackage(metadata, entry, version);
    check(
        !Object.keys(metadata).some(
            key => key.startsWith("_") || /^(?:auth|authentication|authToken|password|token|registry)$/i.test(key),
        ),
        `${entry.name} contains private package settings`,
    );
    check(
        !Object.keys(metadata.scripts ?? {}).some(key =>
            /^(?:preinstall|install|postinstall|prepare|prepublish|prepublishOnly|prepack|postpack|publish|postpublish)$/.test(
                key,
            ),
        ),
        `${entry.name} contains release/install lifecycle scripts`,
    );
    if (root) {
        const workspace = path.join(root, entry.workspace);
        for (const relative of walk(path.join(workspace, "lib", entry.slug), `lib/${entry.slug}`)) {
            if (!allowedFile(relative, entry)) continue;
            const bytes = files.get(relative);
            check(bytes, `${entry.name} tarball omits built runtime file ${relative}`);
            check(
                bytes.equals(fs.readFileSync(path.join(workspace, relative))),
                `${entry.name} tarball differs from built runtime file ${relative}`,
            );
        }
        for (const { relative, source } of localizationFiles(root, entry)) {
            const bytes = files.get(relative);
            check(bytes, `${entry.name} tarball omits localization ${relative}`);
            same(
                JSON.parse(bytes.toString("utf8")),
                readJson(source),
                `${entry.name} localization content differs from source: ${relative}`,
            );
        }
        for (const legal of [
            "README.md",
            "CHANGELOG.md",
            "LICENSE",
            "NOTICE.txt",
            "specification.md",
            "style.md",
            "ARCHITECTURE.md",
        ]) {
            const source = legal === "LICENSE" ? path.join(root, legal) : path.join(workspace, legal);
            if (fs.existsSync(source)) {
                check(
                    files.get(legal)?.equals(fs.readFileSync(source)),
                    `${entry.name} missing or changed legal/documentation output ${legal}`,
                );
            }
        }
    }
    return metadata;
}

export function validateManifest(manifest: ReleaseManifest, dist: string): ReleaseManifest {
    check(manifest && manifest.schemaVersion === 1, "Release manifest schemaVersion must be 1");
    same(
        Object.keys(manifest).sort(),
        ["packages", "releaseVersion", "schemaVersion", "sourceCommit"],
        "Release manifest contains unexpected fields",
    );
    const tag = versionTag(manifest.releaseVersion);
    check(
        typeof manifest.sourceCommit === "string" && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(manifest.sourceCommit),
        "Release manifest must contain a git sourceCommit",
    );
    check(
        Array.isArray(manifest.packages) && manifest.packages.length === PACKAGES.length,
        "Release manifest must contain exactly three ordered packages",
    );
    const allowedRoot = ["npm", "release-manifest.json"];
    check(
        fs.readdirSync(dist).every(name => allowedRoot.includes(name)),
        "Release output contains unexpected files",
    );
    same(
        fs.readdirSync(inside(dist, "npm")).sort(),
        PACKAGES.map(entry => entry.slug).sort(),
        "Release output contains unexpected package directories",
    );
    manifest.packages.forEach((item, index) => {
        const entry = PACKAGES[index];
        same(
            Object.keys(item).sort(),
            ["distTag", "integrity", "internalDependencies", "name", "tarball", "version", "workspace"],
            `Release manifest contains unexpected fields for ${entry.name}`,
        );
        check(
            item.name === entry.name &&
                item.workspace === entry.workspace &&
                item.version === manifest.releaseVersion &&
                item.distTag === tag,
            `Release manifest identity/order/version/tag mismatch for ${entry.name}`,
        );
        safeRelative(item.workspace);
        const filename = inside(dist, item.tarball);
        check(
            item.tarball.startsWith(`npm/${entry.slug}/`) &&
                item.tarball.split("/").length === 3 &&
                item.tarball.endsWith(".tgz"),
            `Unexpected tarball destination for ${entry.name}`,
        );
        same(
            item.internalDependencies,
            Object.fromEntries(entry.dependencies.map(name => [name, manifest.releaseVersion])),
            `Release manifest internal dependency closure mismatch for ${entry.name}`,
        );
        check(
            typeof item.integrity === "string" && /^sha512-[A-Za-z0-9+/]{86}==$/.test(item.integrity),
            `Invalid SHA512 integrity for ${entry.name}`,
        );
        check(fs.existsSync(filename) && fs.statSync(filename).isFile(), `Missing tarball ${item.tarball}`);
        check(integrity(fs.readFileSync(filename)) === item.integrity, `Integrity mismatch for ${item.tarball}`);
        same(
            fs.readdirSync(path.dirname(filename)),
            [path.basename(filename)],
            `${entry.name} output must contain exactly one tarball`,
        );
    });
    return manifest;
}

export async function verifyManifest(manifest: ReleaseManifest, dist: string, root?: string): Promise<void> {
    validateManifest(manifest, dist);
    for (const [index, item] of manifest.packages.entries()) {
        const metadata = await inspectTarball(
            inside(dist, item.tarball),
            PACKAGES[index],
            manifest.releaseVersion,
            root,
        );
        same(
            item.internalDependencies,
            internalDependencies(metadata),
            `${item.name} manifest differs from tar metadata`,
        );
    }
}

export async function packRelease(root: string): Promise<ReleaseManifest> {
    const release = loadRelease(root);
    const dist = path.join(root, "dist");
    fs.mkdirSync(dist, { recursive: true });
    check(!fs.lstatSync(dist).isSymbolicLink(), "dist must not be a symlink");
    const manifestPath = inside(dist, "release-manifest.json");
    fs.rmSync(manifestPath, { force: true });
    const manifest: ReleaseManifest = {
        schemaVersion: 1,
        releaseVersion: release.version,
        sourceCommit: run("git", ["rev-parse", "HEAD"], { cwd: root }),
        packages: [],
    };
    try {
        check(fs.existsSync(path.join(root, "LICENSE")), "Repository LICENSE is missing");
        for (const entry of PACKAGES) {
            const workspace = path.join(root, entry.workspace);
            requireBuiltOutputs(root, entry);
            for (const required of [entry.main, entry.types, "README.md"]) {
                check(
                    fs.existsSync(path.join(workspace, required)),
                    `${entry.name} missing build output ${required}; build first`,
                );
            }
            for (const { relative, source } of localizationFiles(root, entry)) {
                const built = path.join(workspace, relative);
                check(fs.existsSync(built), `${entry.name} missing built localization ${relative}; build first`);
                same(
                    readJson(built),
                    readJson(source),
                    `${entry.name} stale built localization ${relative}; build first`,
                );
            }
            const output = inside(dist, `npm/${entry.slug}`);
            fs.rmSync(output, { force: true, recursive: true });
            fs.mkdirSync(output, { recursive: true });
            const staging = fs.mkdtempSync(path.join(os.tmpdir(), "powerquery-package-"));
            let result: unknown;
            try {
                const production = `lib/${entry.slug}`;
                for (const file of walk(path.join(workspace, production), production)) {
                    check(allowedFile(file, entry), `${entry.name} contains unexpected built file: ${file}`);
                    const destination = path.join(staging, file);
                    fs.mkdirSync(path.dirname(destination), { recursive: true });
                    fs.copyFileSync(path.join(workspace, file), destination);
                }
                for (const file of [
                    "package.json",
                    "README.md",
                    "CHANGELOG.md",
                    "NOTICE.txt",
                    "specification.md",
                    "style.md",
                    "ARCHITECTURE.md",
                ]) {
                    if (fs.existsSync(path.join(workspace, file))) {
                        fs.copyFileSync(path.join(workspace, file), path.join(staging, file));
                    }
                }
                fs.copyFileSync(path.join(root, "LICENSE"), path.join(staging, "LICENSE"));
                result = JSON.parse(
                    npm(["pack", staging, "--ignore-scripts", "--json", "--pack-destination", output], { cwd: root }),
                );
            } finally {
                fs.rmSync(staging, { recursive: true, force: true });
            }
            check(
                Array.isArray(result) && result.length === 1 && typeof result[0].filename === "string",
                "npm pack returned unexpected JSON",
            );
            const actual = safeRelative(result[0].filename);
            check(!actual.includes("/") && actual.endsWith(".tgz"), "npm pack returned an unsafe filename");
            const filename = inside(output, actual);
            const metadata = await inspectTarball(filename, entry, release.version, root);
            manifest.packages.push({
                name: metadata.name,
                version: metadata.version,
                workspace: entry.workspace,
                tarball: `npm/${entry.slug}/${actual}`,
                integrity: integrity(fs.readFileSync(filename)),
                internalDependencies: internalDependencies(metadata),
                distTag: metadata.publishConfig.tag,
            });
        }
        await verifyManifest(manifest, dist, root);
        writeJson(manifestPath, manifest);
        validateManifest(readJson(manifestPath), dist);
        return manifest;
    } catch (error) {
        fs.rmSync(manifestPath, { force: true });
        throw error;
    }
}

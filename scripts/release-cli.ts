import { ROOT, bumpPatch, check, setVersion } from "./release";
import { packRelease } from "./release-artifacts";
import { validateConsumer } from "./release-consumer";

async function main(args: string[]): Promise<void> {
    const [command, ...rest] = args;
    check(
        ["version", "patch", "pack", "validate"].includes(command) &&
            (command === "version" ? rest.length === 1 : rest.length === 0),
        "Usage: ts-node scripts/release-cli.ts version <SemVer> | patch | pack | validate",
    );
    if (command === "version") {
        setVersion(rest[0]);
        console.log(`Set the public release group to ${rest[0]}`);
    } else if (command === "patch") {
        console.log(`Set the public release group to ${bumpPatch()}`);
    } else {
        const manifest = await packRelease(ROOT);
        if (command === "validate") await validateConsumer(ROOT, manifest);
        console.log(`${command === "validate" ? "Validated" : "Packed"} public release ${manifest.releaseVersion}`);
    }
}

main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(`Release failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
});

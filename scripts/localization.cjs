"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Keep the published ID-keyed JSON paths as compatibility views of the l10n bundles.
function localizationFiles(workspace, slug) {
    const localization = path.join(workspace, "src", "localization");
    if (slug === "powerquery-formatter") return [];
    const stem = slug === "powerquery-parser" ? "template" : "templates";
    const defaults = JSON.parse(fs.readFileSync(path.join(localization, "templates", `${stem}.json`), "utf8"));
    const bundles = path.join(localization, "bundles");
    const filenames = fs.readdirSync(bundles).filter((file) => /^bundle\.l10n(?:\.[A-Za-z-]+)?\.json$/.test(file));
    if (filenames.length < 2 || !filenames.includes("bundle.l10n.json") ||
        !filenames.includes("bundle.l10n.fr-FR.json")) {
        throw new Error(`${slug} lacks baseline source localizations`);
    }
    return filenames.flatMap((file) => {
        const bundle = JSON.parse(fs.readFileSync(path.join(bundles, file), "utf8"));
        const templates = Object.fromEntries(Object.entries(defaults).map(([key, message]) => {
            const translation = bundle[message];
            return [key, typeof translation === "string" ? translation : translation?.message ?? message];
        }));
        const suffix = file.slice("bundle.l10n".length);
        return [
            { relative: `localization/bundles/${file}`, contents: bundle },
            { relative: `localization/templates/${stem}${suffix}`, contents: templates },
        ];
    });
}

module.exports = { localizationFiles };

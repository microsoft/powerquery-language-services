// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { l10nJsonFormat, l10nJsonMessageFormat } from "@vscode/l10n";

export function createTemplates<T extends Record<string, string>>(
    defaults: T,
    bundle: l10nJsonFormat,
): { [K in keyof T]: string } {
    const templates: { [K in keyof T]: string } = { ...defaults };

    for (const key in templates) {
        const message: string = templates[key];
        const translation: l10nJsonMessageFormat | undefined = bundle[message];
        templates[key] = typeof translation === "string" ? translation : (translation?.message ?? message);
    }

    return templates;
}

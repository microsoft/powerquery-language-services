// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as l10n from "@vscode/l10n";
import { expect } from "chai";

import { createLazyTemplates, createTemplates } from "../../src/localization/templateUtils";
import { Localization, LocalizationUtils, Templates } from "../../src";
import { ParseError } from "../../src/parser";
import { Token } from "../../src/language";

describe("Localization", () => {
    afterEach(() => {
        l10n.config({ contents: {} });
    });

    it("selects exact locales case-insensitively and falls back to English", () => {
        expect(LocalizationUtils.getLocalizationTemplates("FR-fr")).to.equal(Templates.fr_FR);
        expect(LocalizationUtils.getLocalizationTemplates("fr")).to.equal(Templates.DefaultTemplates);
        expect(LocalizationUtils.getLocalizationTemplates("unknown")).to.equal(Templates.DefaultTemplates);
    });

    it("keeps localized token names and error substitutions together", () => {
        const error: ParseError.ExpectedTokenKindError = new ParseError.ExpectedTokenKindError(
            Token.TokenKind.Identifier,
            undefined,
            "fr-FR",
        );

        expect(error.message).to.equal(
            Templates.fr_FR.error_parse_expectTokenKind_2_endOfStream.replace(
                "{expectedTokenKind}",
                Templates.fr_FR.tokenKind_identifier,
            ),
        );
    });

    it("does not change templates retained by a caller when another locale is requested", () => {
        const french: Templates.ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates("fr-FR");
        const german: Templates.ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates("de-DE");

        expect(Localization.error_common_cancellationError(french, "timeout")).to.equal(
            Templates.fr_FR.error_common_cancellationError.replace("{reason}", "timeout"),
        );

        expect(Localization.error_common_cancellationError(german, "timeout")).to.equal(
            Templates.de_DE.error_common_cancellationError.replace("{reason}", "timeout"),
        );
    });

    it("uses l10n substitution semantics without reinterpreting argument text", () => {
        const reason: string = "$& {reason} $1";

        const templates: Templates.ILocalizationTemplates = {
            ...Templates.DefaultTemplates,
            error_common_cancellationError: "{reason} / {reason}",
        };

        expect(Localization.error_common_cancellationError(templates, reason)).to.equal(`${reason} / ${reason}`);
    });

    it("reads l10n message objects and falls back per missing message", () => {
        expect(
            createTemplates(
                { translated: "English", fallback: "Missing" },
                { English: { message: "Translated", comment: ["Context"] } },
            ),
        ).to.deep.equal({ translated: "Translated", fallback: "Missing" });
    });

    it("defers locale construction, caches it, and preserves object reflection and mutations", () => {
        let loads: number = 0;
        const defaults: { translated: string; fallback: string } = { translated: "English", fallback: "Missing" };

        const templates: typeof defaults = createLazyTemplates(defaults, () => {
            loads += 1;

            return { English: "Translated" };
        });

        expect(loads).to.equal(0);
        expect(Object.getPrototypeOf(templates)).to.equal(Object.prototype);
        expect(loads).to.equal(0);
        expect("translated" in templates).to.equal(true);
        expect(loads).to.equal(1);
        expect(templates.translated).to.equal("Translated");
        expect(Object.keys(templates)).to.deep.equal(["translated", "fallback"]);
        expect({ ...templates }).to.deep.equal({ translated: "Translated", fallback: "Missing" });
        templates.fallback = "Updated";
        expect(templates.fallback).to.equal("Updated");
        expect(defaults.fallback).to.equal("Missing");
        Object.defineProperty(templates, "translated", { value: "Locked", writable: false, configurable: false });
        expect(templates.translated).to.equal("Locked");
        Object.freeze(templates);
        expect(Object.isFrozen(templates)).to.equal(true);
        expect(loads).to.equal(1);
    });

    it("does not cache a failed locale load as a successful initialization", () => {
        let loads: number = 0;

        const templates: { translated: string } = createLazyTemplates({ translated: "English" }, () => {
            loads += 1;

            if (loads === 1) {
                throw new Error("Bundle unavailable");
            }

            return { English: "Translated" };
        });

        expect(() => templates.translated).to.throw("Bundle unavailable");
        expect(templates.translated).to.equal("Translated");
        expect(loads).to.equal(2);
    });

    it("does not consume or overwrite an ordinary host l10n bundle", () => {
        l10n.config({
            contents: {
                "CancellationError: {reason}": "Host cancellation {reason}",
                [Templates.fr_FR.error_common_cancellationError]: "Host French cancellation {reason}",
                "Host {value}": "Host translation {value}",
            },
        });

        expect(Localization.error_common_cancellationError(Templates.DefaultTemplates, "x")).to.equal(
            "CancellationError: x",
        );

        expect(Localization.error_common_cancellationError(Templates.fr_FR, "x")).to.equal(
            Templates.fr_FR.error_common_cancellationError.replace("{reason}", "x"),
        );

        expect(l10n.t("Host {value}", { value: "unchanged" })).to.equal("Host translation unchanged");
    });
});

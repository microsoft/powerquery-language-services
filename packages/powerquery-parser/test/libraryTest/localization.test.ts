// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as l10n from "@vscode/l10n";
import { expect } from "chai";

import { Localization, LocalizationUtils, Templates } from "../../src";
import { createTemplates } from "../../src/localization/templateUtils";
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

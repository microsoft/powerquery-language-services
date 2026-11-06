// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as formatter from "@microsoft/powerquery-formatter";
import * as l10n from "@vscode/l10n";
import * as PQP from "@microsoft/powerquery-parser";
import { expect } from "chai";

import * as Templates from "../src/localization/templates";
import { AnalysisSettings, Diagnostic, DiagnosticErrorCode } from "../src";
import { Localization, LocalizationUtils } from "../src/localization";
import { SimpleLibraryAnalysisSettings, SimpleLibraryValidateAllSettings } from "./testConstants";
import { assertValidateDiagnostics } from "./testUtils/validationTestUtils";

describe("Localization", () => {
    afterEach(() => {
        l10n.config({ contents: {} });
    });

    it("retains case-insensitive exact locale selection and English fallback", () => {
        expect(LocalizationUtils.getLocalizationTemplates("FR-fr")).to.equal(Templates.fr_FR);
        expect(LocalizationUtils.getLocalizationTemplates("fr")).to.equal(Templates.DefaultTemplates);
        expect(LocalizationUtils.getLocalizationTemplates("unknown")).to.equal(Templates.DefaultTemplates);
    });

    it("formats named and numeric diagnostic arguments", () => {
        expect(
            Localization.error_validation_invokeExpression_missingMandatory(Templates.DefaultTemplates, "f", "x"),
        ).to.equal("'f' is missing an argument for the non-optional parameter 'x'.");

        expect(Localization.error_validation_invokeExpression_numArgs(Templates.DefaultTemplates, 1, 2, 3)).to.equal(
            "Expected between 1-2 arguments, but 3 were given.",
        );
    });

    it("keeps interleaved parser and validation locales independent", async () => {
        l10n.config({
            contents: {
                "Duplicate identifier '{identifier}'": "Host duplicate {identifier}",
                [Templates.fr_FR.error_validation_duplicate_identifier]: "Host French duplicate {identifier}",
                "Host {value}": "Host translation {value}",
            },
        });

        await Promise.all(
            ["fr-FR", "de-DE", "ja-JP", "en-US", "fr-FR"].map(async (locale: string) => {
                const analysisSettings: AnalysisSettings = {
                    ...SimpleLibraryAnalysisSettings,
                    inspectionSettings: { ...SimpleLibraryAnalysisSettings.inspectionSettings, locale },
                };

                const diagnostics: Diagnostic[] = await assertValidateDiagnostics({
                    text: "let x = 1, x = 2 in x",
                    analysisSettings,
                    validationSettings: { ...SimpleLibraryValidateAllSettings, locale },
                });

                const templates: Templates.ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(locale);

                expect(
                    diagnostics
                        .filter((diagnostic: Diagnostic) => diagnostic.code === DiagnosticErrorCode.DuplicateIdentifier)
                        .map((diagnostic: Diagnostic) => diagnostic.message),
                ).to.deep.equal([
                    templates.error_validation_duplicate_identifier.replace("{identifier}", "x"),
                    templates.error_validation_duplicate_identifier.replace("{identifier}", "x"),
                ]);

                const parsed: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(
                    { ...PQP.DefaultSettings, locale },
                    "let",
                );

                PQP.TaskUtils.assertIsParseStageParseError(parsed);

                const parserTemplates: PQP.Templates.ILocalizationTemplates =
                    PQP.LocalizationUtils.getLocalizationTemplates(locale);

                expect(parsed.error.message).to.equal(
                    parserTemplates.error_parse_expectTokenKind_2_endOfStream.replace(
                        "{expectedTokenKind}",
                        parserTemplates.tokenKind_identifier,
                    ),
                );

                const formatted: formatter.TriedFormat = await formatter.tryFormat(
                    { ...formatter.DefaultSettings, locale },
                    "let",
                );

                PQP.ResultUtils.assertIsError(formatted);
                expect(formatted.error.message).to.equal(parsed.error.message);
            }),
        );

        expect(l10n.t("Host {value}", { value: "unchanged" })).to.equal("Host translation unchanged");
    });

    it("formats repeated placeholders and leaves replacement text literal", () => {
        const identifier: string = "$& {suggestion}";

        const templates: Templates.ILocalizationTemplates = {
            ...Templates.DefaultTemplates,
            error_validation_unknownIdentifier_suggestion: "{identifier} / {identifier} / {suggestion}",
        };

        expect(Localization.error_validation_unknownIdentifier(templates, identifier, "$1")).to.equal(
            `${identifier} / ${identifier} / $1`,
        );
    });

    it("substitutes every translated diagnostic placeholder in every locale", () => {
        for (const [locale, templates] of Templates.TemplatesByLocale) {
            const messages: string[] = [
                Localization.error_validation_duplicate_identifier(templates, "x"),
                Localization.error_validation_invokeExpression_missingMandatory(templates, "f", "x"),
                Localization.error_validation_invokeExpression_missingMandatory(templates, undefined, "x"),
                Localization.error_validation_invokeExpression_numArgs(templates, 1, 2, 3),
                Localization.error_validation_invokeExpression_typeMismatch(templates, "f", "x", "number", "text"),
                Localization.error_validation_invokeExpression_typeMismatch(
                    templates,
                    undefined,
                    "x",
                    "number",
                    "text",
                ),
                Localization.error_validation_unknownIdentifier(templates, "x", undefined),
                Localization.error_validation_unknownIdentifier(templates, "x", "y"),
                Localization.parameterDocumentation_default(templates, "1"),
                Localization.parameterDocumentation_allowedValues(templates, "1, 2"),
                Localization.parameterDocumentation_sampleValues(templates, "1"),
                Localization.parameterDocumentation_type(templates, "number"),
            ];

            for (const message of messages) {
                expect(message, locale).not.to.match(/\{[^}]+\}/);
            }
        }
    });
});

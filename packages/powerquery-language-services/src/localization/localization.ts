import * as l10n from "@vscode/l10n";

import { ILocalizationTemplates } from "./templates";

interface ILocalization {
    error_validation_duplicate_identifier: (templates: ILocalizationTemplates, identifier: string) => string;

    error_validation_invokeExpression_missingMandatory: (
        templates: ILocalizationTemplates,
        functionName: string | undefined,
        argName: string,
    ) => string;

    error_validation_invokeExpression_numArgs: (
        templates: ILocalizationTemplates,
        numMin: number,
        numMax: number,
        numGiven: number,
    ) => string;

    error_validation_invokeExpression_typeMismatch: (
        templates: ILocalizationTemplates,
        functionName: string | undefined,
        argName: string,
        expected: string,
        actual: string,
    ) => string;

    error_validation_unknownIdentifier: (
        templates: ILocalizationTemplates,
        identifier: string,
        suggestion: string | undefined,
    ) => string;

    parameterDocumentation_default: (templates: ILocalizationTemplates, value: string) => string;

    parameterDocumentation_allowedValues: (templates: ILocalizationTemplates, values: string) => string;

    parameterDocumentation_sampleValues: (templates: ILocalizationTemplates, values: string) => string;

    parameterDocumentation_type: (templates: ILocalizationTemplates, type: string) => string;
}

export const Localization: ILocalization = {
    error_validation_duplicate_identifier: (templates: ILocalizationTemplates, identifier: string) =>
        format(templates.error_validation_duplicate_identifier, { identifier }),

    error_validation_invokeExpression_missingMandatory: (
        templates: ILocalizationTemplates,
        functionName: string | undefined,
        argName: string,
    ) => {
        if (functionName) {
            return format(templates.error_validation_invokeExpression_missingMandatory_named, {
                funcName: functionName,
                argName,
            });
        } else {
            return format(templates.error_validation_invokeExpression_missingMandatory_unnamed, { argName });
        }
    },

    error_validation_invokeExpression_numArgs: (
        templates: ILocalizationTemplates,
        numMin: number,
        numMax: number,
        numGiven: number,
    ) => format(templates.error_validation_invokeExpression_numArgs, { numMin, numMax, numGiven }),

    error_validation_invokeExpression_typeMismatch: (
        templates: ILocalizationTemplates,
        functionName: string | undefined,
        argName: string,
        expected: string,
        actual: string,
    ) => {
        if (functionName) {
            return format(templates.error_validation_invokeExpression_typeMismatch_named, {
                funcName: functionName,
                argName,
                expected,
                actual,
            });
        } else {
            return format(templates.error_validation_invokeExpression_typeMismatch_unnamed, {
                argName,
                expected,
                actual,
            });
        }
    },

    error_validation_unknownIdentifier: (
        templates: ILocalizationTemplates,
        identifier: string,
        suggestion: string | undefined,
    ) => {
        if (suggestion === undefined) {
            return format(templates.error_validation_unknownIdentifier_noSuggestion, { identifier });
        } else {
            return format(templates.error_validation_unknownIdentifier_suggestion, { identifier, suggestion });
        }
    },

    parameterDocumentation_default: (templates: ILocalizationTemplates, value: string) =>
        format(templates.parameterDocumentation_default, { value }),

    parameterDocumentation_allowedValues: (templates: ILocalizationTemplates, values: string) =>
        format(templates.parameterDocumentation_allowedValues, { values }),

    parameterDocumentation_sampleValues: (templates: ILocalizationTemplates, values: string) =>
        format(templates.parameterDocumentation_sampleValues, { values }),

    parameterDocumentation_type: (templates: ILocalizationTemplates, type: string) =>
        format(templates.parameterDocumentation_type, { type }),
};

function format(message: string, args: Record<string, l10n.L10nReplacement>): string {
    // The namespace prevents ordinary host bundles from translating locale-resolved text again.
    return l10n.t({ message, args, comment: "@microsoft/powerquery-language-services" });
}

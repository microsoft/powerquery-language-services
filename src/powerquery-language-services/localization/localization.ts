import { StringUtils } from "@microsoft/powerquery-parser";

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
        StringUtils.assertGetFormatted(
            templates.error_validation_duplicate_identifier,
            new Map([["identifier", identifier]]),
        ),

    error_validation_invokeExpression_missingMandatory: (
        templates: ILocalizationTemplates,
        functionName: string | undefined,
        argName: string,
    ) => {
        if (functionName) {
            return StringUtils.assertGetFormatted(
                templates.error_validation_invokeExpression_missingMandatory_named,
                new Map([
                    ["funcName", functionName],
                    ["argName", argName],
                ]),
            );
        } else {
            return StringUtils.assertGetFormatted(
                templates.error_validation_invokeExpression_missingMandatory_unnamed,
                new Map([["argName", argName]]),
            );
        }
    },

    error_validation_invokeExpression_numArgs: (
        templates: ILocalizationTemplates,
        numMin: number,
        numMax: number,
        numGiven: number,
    ) =>
        StringUtils.assertGetFormatted(
            templates.error_validation_invokeExpression_numArgs,
            new Map([
                ["numMin", numMin.toString()],
                ["numMax", numMax.toString()],
                ["numGiven", numGiven.toString()],
            ]),
        ),

    error_validation_invokeExpression_typeMismatch: (
        templates: ILocalizationTemplates,
        functionName: string | undefined,
        argName: string,
        expected: string,
        actual: string,
    ) => {
        if (functionName) {
            return StringUtils.assertGetFormatted(
                templates.error_validation_invokeExpression_typeMismatch_named,
                new Map([
                    ["funcName", functionName],
                    ["argName", argName],
                    ["expected", expected],
                    ["actual", actual],
                ]),
            );
        } else {
            return StringUtils.assertGetFormatted(
                templates.error_validation_invokeExpression_typeMismatch_unnamed,
                new Map([
                    ["argName", argName],
                    ["expected", expected],
                    ["actual", actual],
                ]),
            );
        }
    },

    error_validation_unknownIdentifier: (
        templates: ILocalizationTemplates,
        identifier: string,
        suggestion: string | undefined,
    ) => {
        if (suggestion === undefined) {
            return StringUtils.assertGetFormatted(
                templates.error_validation_unknownIdentifier_noSuggestion,
                new Map([["identifier", identifier]]),
            );
        } else {
            return StringUtils.assertGetFormatted(
                templates.error_validation_unknownIdentifier_suggestion,
                new Map([
                    ["identifier", identifier],
                    ["suggestion", suggestion],
                ]),
            );
        }
    },

    parameterDocumentation_default: (templates: ILocalizationTemplates, value: string) =>
        StringUtils.assertGetFormatted(
            templates.parameterDocumentation_default,
            new Map([["value", value]]),
        ),

    parameterDocumentation_allowedValues: (templates: ILocalizationTemplates, values: string) =>
        StringUtils.assertGetFormatted(
            templates.parameterDocumentation_allowedValues,
            new Map([["values", values]]),
        ),

    parameterDocumentation_sampleValues: (templates: ILocalizationTemplates, values: string) =>
        StringUtils.assertGetFormatted(
            templates.parameterDocumentation_sampleValues,
            new Map([["values", values]]),
        ),

    parameterDocumentation_type: (templates: ILocalizationTemplates, type: string) =>
        StringUtils.assertGetFormatted(
            templates.parameterDocumentation_type,
            new Map([["type", type]]),
        ),
};

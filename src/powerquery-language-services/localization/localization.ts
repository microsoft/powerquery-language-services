import * as PQP from "@microsoft/powerquery-parser";

import { ILocalizationTemplates } from "./templates";

interface ILocalization {
    error_validation_duplicate_identifier: (templates: ILocalizationTemplates, identifier: string) => string;

    error_validation_invokeExpression_missingMandatory_named: (
        templates: ILocalizationTemplates,
        funcName: string,
        argName: string,
    ) => string;

    error_validation_invokeExpression_missingMandatory_unnamed: (
        templates: ILocalizationTemplates,
        argName: string,
    ) => string;

    error_validation_invokeExpression_typeMismatch_named: (
        templates: ILocalizationTemplates,
        funcName: string,
        argName: string,
        expected: string,
        actual: string,
    ) => string;

    error_validation_invokeExpression_typeMismatch_unnamed: (
        templates: ILocalizationTemplates,
        argName: string,
        expected: string,
        actual: string,
    ) => string;
}

export const Localization: ILocalization = {
    error_validation_duplicate_identifier: (templates: ILocalizationTemplates, identifier: string) =>
        PQP.StringUtils.assertGetFormatted(
            templates.error_validation_duplicate_identifier,
            new Map([["identifier", identifier]]),
        ),

    error_validation_invokeExpression_missingMandatory_named: (
        templates: ILocalizationTemplates,
        funcName: string,
        argName: string,
    ) =>
        PQP.StringUtils.assertGetFormatted(
            templates.error_validation_invokeExpression_typeMismatch_unnamed,
            new Map([
                ["funcName", funcName],
                ["argName", argName],
            ]),
        ),

    error_validation_invokeExpression_missingMandatory_unnamed: (templates: ILocalizationTemplates, argName: string) =>
        PQP.StringUtils.assertGetFormatted(
            templates.error_validation_invokeExpression_typeMismatch_unnamed,
            new Map([["argName", argName]]),
        ),

    error_validation_invokeExpression_typeMismatch_named: (
        templates: ILocalizationTemplates,
        funcName: string,
        argName: string,
        expected: string,
        actual: string,
    ) =>
        PQP.StringUtils.assertGetFormatted(
            templates.error_validation_invokeExpression_typeMismatch_named,
            new Map([
                ["funcName", funcName],
                ["argName", argName],
                ["expected", expected],
                ["actual", actual],
            ]),
        ),

    error_validation_invokeExpression_typeMismatch_unnamed: (
        templates: ILocalizationTemplates,
        argName: string,
        expected: string,
        actual: string,
    ) =>
        PQP.StringUtils.assertGetFormatted(
            templates.error_validation_invokeExpression_typeMismatch_unnamed,
            new Map([
                ["argName", argName],
                ["expected", expected],
                ["actual", actual],
            ]),
        ),
};

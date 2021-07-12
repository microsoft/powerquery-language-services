import * as PQP from "@microsoft/powerquery-parser";

import { ILocalizationTemplates } from "./templates";

interface ILocalization {
    error_validation_duplicate_identifier: (templates: ILocalizationTemplates, identifier: string) => string;

    error_validation_invokeExpression_missingMandatory: (
        templates: ILocalizationTemplates,
        maybeFuncName: string | undefined,
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
        maybeFuncName: string | undefined,
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

    error_validation_invokeExpression_missingMandatory: (
        templates: ILocalizationTemplates,
        maybeFuncName: string | undefined,
        argName: string,
    ) => {
        if (maybeFuncName) {
            return PQP.StringUtils.assertGetFormatted(
                templates.error_validation_invokeExpression_typeMismatch_named,
                new Map([
                    ["funcName", maybeFuncName],
                    ["argName", argName],
                ]),
            );
        } else {
            return PQP.StringUtils.assertGetFormatted(
                templates.error_validation_invokeExpression_typeMismatch_unnamed,
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
        PQP.StringUtils.assertGetFormatted(
            templates.error_validation_invokeExpression_numArgs,
            new Map([
                ["numMin", numMin.toString()],
                ["numMax", numMax.toString()],
                ["numGiven", numGiven.toString()],
            ]),
        ),

    error_validation_invokeExpression_typeMismatch: (
        templates: ILocalizationTemplates,
        maybeFuncName: string | undefined,
        argName: string,
        expected: string,
        actual: string,
    ) => {
        if (maybeFuncName) {
            return PQP.StringUtils.assertGetFormatted(
                templates.error_validation_invokeExpression_typeMismatch_named,
                new Map([
                    ["funcName", maybeFuncName],
                    ["argName", argName],
                    ["expected", expected],
                    ["actual", actual],
                ]),
            );
        } else {
            return PQP.StringUtils.assertGetFormatted(
                templates.error_validation_invokeExpression_typeMismatch_unnamed,
                new Map([
                    ["argName", argName],
                    ["expected", expected],
                    ["actual", actual],
                ]),
            );
        }
    },
};

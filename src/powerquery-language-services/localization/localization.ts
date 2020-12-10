import * as PQP from "@microsoft/powerquery-parser";
import { ILocalizationTemplates } from "./templates";

interface ILocalization {
    error_validation_duplicate_identifier: (templates: ILocalizationTemplates, identifier: string) => string;
}

export const Localization: ILocalization = {
    error_validation_duplicate_identifier: (templates: ILocalizationTemplates, identifier: string) => {
        return PQP.StringUtils.assertGetFormatted(
            templates.error_validation_duplicate_identifier,
            new Map([["identifier", identifier]]),
        );
    },
};

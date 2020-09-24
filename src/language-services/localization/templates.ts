import * as PQP from "@microsoft/powerquery-parser";
import * as en_US from "./templates/en-US.json";

export interface ILocalizationTemplates {
    readonly error_validation_duplicate_identifier: string;
}

export const TemplatesByLocale: Map<string, ILocalizationTemplates> = new Map([
    [PQP.Locale.en_US.toLowerCase(), en_US],
]);

export const DefaultTemplates: ILocalizationTemplates = en_US;

export function getLocalizationTemplates(locale: string): ILocalizationTemplates {
    return TemplatesByLocale.get(locale.toLowerCase()) ?? DefaultTemplates;
}

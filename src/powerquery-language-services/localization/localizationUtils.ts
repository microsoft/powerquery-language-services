import { DefaultTemplates, type ILocalizationTemplates, TemplatesByLocale } from "./templates";

export function getLocalizationTemplates(locale: string): ILocalizationTemplates {
    return TemplatesByLocale.get(locale.toLowerCase()) ?? DefaultTemplates;
}

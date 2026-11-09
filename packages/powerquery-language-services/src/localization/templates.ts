import * as PQP from "@microsoft/powerquery-parser";
import {
    createLazyTemplates,
    createTemplates,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/localization/templateUtils";

import defaultBundle from "./bundles/bundle.l10n.json";

type TemplateMessageKey = keyof ILocalizationTemplates | "error_validation_duplicate_parameter_name";
type DefaultTemplateKey =
    | TemplateMessageKey
    | `_${Exclude<TemplateMessageKey, "error_validation_invokeExpression_numArgs">}.comment`
    | "_error_validation_invokeExpression_numArgs";
type DefaultTemplateShape = { [K in DefaultTemplateKey]: string };

const defaultTemplates: DefaultTemplateShape = {
    error_validation_duplicate_identifier: defaultBundle["Duplicate identifier '{identifier}'"].message,
    "_error_validation_duplicate_identifier.comment":
        defaultBundle["Duplicate identifier '{identifier}'"].comment.join(""),
    error_validation_duplicate_parameter_name: defaultBundle["Duplicate parameter name '{identifier}'"].message,
    "_error_validation_duplicate_parameter_name.comment":
        defaultBundle["Duplicate parameter name '{identifier}'"].comment.join(""),
    error_validation_invokeExpression_numArgs:
        defaultBundle["Expected between {numMin}-{numMax} arguments, but {numGiven} were given."].message,
    _error_validation_invokeExpression_numArgs:
        defaultBundle["Expected between {numMin}-{numMax} arguments, but {numGiven} were given."].comment.join(""),
    error_validation_invokeExpression_missingMandatory_named:
        defaultBundle["'{funcName}' is missing an argument for the non-optional parameter '{argName}'."].message,
    "_error_validation_invokeExpression_missingMandatory_named.comment":
        defaultBundle["'{funcName}' is missing an argument for the non-optional parameter '{argName}'."].comment.join(
            "",
        ),
    error_validation_invokeExpression_missingMandatory_unnamed:
        defaultBundle["Missing an argument for the non-optional parameter '{argName}'."].message,
    "_error_validation_invokeExpression_missingMandatory_unnamed.comment":
        defaultBundle["Missing an argument for the non-optional parameter '{argName}'."].comment.join(""),
    error_validation_invokeExpression_typeMismatch_named:
        defaultBundle[
            "'{funcName}' expected the argument for '{argName}' to be '{expected}', but got '{actual}' instead."
        ].message,
    "_error_validation_invokeExpression_typeMismatch_named.comment":
        defaultBundle[
            "'{funcName}' expected the argument for '{argName}' to be '{expected}', but got '{actual}' instead."
        ].comment.join(""),
    error_validation_invokeExpression_typeMismatch_unnamed:
        defaultBundle["Expected the argument for '{argName}' to be '{expected}', but got '{actual}' instead."].message,
    "_error_validation_invokeExpression_typeMismatch_unnamed.comment":
        defaultBundle[
            "Expected the argument for '{argName}' to be '{expected}', but got '{actual}' instead."
        ].comment.join(""),
    error_validation_unknownIdentifier_noSuggestion: defaultBundle["Cannot find the name '{identifier}'."].message,
    "_error_validation_unknownIdentifier_noSuggestion.comment":
        defaultBundle["Cannot find the name '{identifier}'."].comment.join(""),
    error_validation_unknownIdentifier_suggestion:
        defaultBundle["Cannot find the name '{identifier}', did you mean '{suggestion}'?"].message,
    "_error_validation_unknownIdentifier_suggestion.comment":
        defaultBundle["Cannot find the name '{identifier}', did you mean '{suggestion}'?"].comment.join(""),
    parameterDocumentation_default: defaultBundle["Default: `{value}`"].message,
    "_parameterDocumentation_default.comment": defaultBundle["Default: `{value}`"].comment.join(""),
    parameterDocumentation_allowedValues: defaultBundle["Allowed values: {values}"].message,
    "_parameterDocumentation_allowedValues.comment": defaultBundle["Allowed values: {values}"].comment.join(""),
    parameterDocumentation_sampleValues: defaultBundle["Sample values: {values}"].message,
    "_parameterDocumentation_sampleValues.comment": defaultBundle["Sample values: {values}"].comment.join(""),
    parameterDocumentation_type: defaultBundle["Type: `{type}`"].message,
    "_parameterDocumentation_type.comment": defaultBundle["Type: `{type}`"].comment.join(""),
};

export const en_US: typeof defaultTemplates = createTemplates(defaultTemplates, defaultBundle);
export const bg_BG: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.bg-BG.json") => require("./bundles/bundle.l10n.bg-BG.json"),
);
export const ca_ES: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.ca-ES.json") => require("./bundles/bundle.l10n.ca-ES.json"),
);
export const cs_CZ: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.cs-CZ.json") => require("./bundles/bundle.l10n.cs-CZ.json"),
);
export const da_DK: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.da-DK.json") => require("./bundles/bundle.l10n.da-DK.json"),
);
export const de_DE: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.de-DE.json") => require("./bundles/bundle.l10n.de-DE.json"),
);
export const el_GR: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.el-GR.json") => require("./bundles/bundle.l10n.el-GR.json"),
);
export const es_ES: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.es-ES.json") => require("./bundles/bundle.l10n.es-ES.json"),
);
export const et_EE: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.et-EE.json") => require("./bundles/bundle.l10n.et-EE.json"),
);
export const eu_ES: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.eu-ES.json") => require("./bundles/bundle.l10n.eu-ES.json"),
);
export const fi_FI: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.fi-FI.json") => require("./bundles/bundle.l10n.fi-FI.json"),
);
export const fr_FR: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.fr-FR.json") => require("./bundles/bundle.l10n.fr-FR.json"),
);
export const gl_ES: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.gl-ES.json") => require("./bundles/bundle.l10n.gl-ES.json"),
);
export const hi_IN: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.hi-IN.json") => require("./bundles/bundle.l10n.hi-IN.json"),
);
export const hr_HR: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.hr-HR.json") => require("./bundles/bundle.l10n.hr-HR.json"),
);
export const hu_HU: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.hu-HU.json") => require("./bundles/bundle.l10n.hu-HU.json"),
);
export const id_ID: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.id-ID.json") => require("./bundles/bundle.l10n.id-ID.json"),
);
export const it_IT: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.it-IT.json") => require("./bundles/bundle.l10n.it-IT.json"),
);
export const ja_JP: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.ja-JP.json") => require("./bundles/bundle.l10n.ja-JP.json"),
);
export const kk_KZ: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.kk-KZ.json") => require("./bundles/bundle.l10n.kk-KZ.json"),
);
export const ko_KR: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.ko-KR.json") => require("./bundles/bundle.l10n.ko-KR.json"),
);
export const lt_LT: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.lt-LT.json") => require("./bundles/bundle.l10n.lt-LT.json"),
);
export const lv_LV: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.lv-LV.json") => require("./bundles/bundle.l10n.lv-LV.json"),
);
export const ms_MY: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.ms-MY.json") => require("./bundles/bundle.l10n.ms-MY.json"),
);
export const nb_NO: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.nb-NO.json") => require("./bundles/bundle.l10n.nb-NO.json"),
);
export const nl_NL: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.nl-NL.json") => require("./bundles/bundle.l10n.nl-NL.json"),
);
export const pl_PL: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.pl-PL.json") => require("./bundles/bundle.l10n.pl-PL.json"),
);
export const pt_BR: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.pt-BR.json") => require("./bundles/bundle.l10n.pt-BR.json"),
);
export const pt_PT: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.pt-PT.json") => require("./bundles/bundle.l10n.pt-PT.json"),
);
export const ro_RO: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.ro-RO.json") => require("./bundles/bundle.l10n.ro-RO.json"),
);
export const ru_RU: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.ru-RU.json") => require("./bundles/bundle.l10n.ru-RU.json"),
);
export const sk_SK: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.sk-SK.json") => require("./bundles/bundle.l10n.sk-SK.json"),
);
export const sl_SI: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.sl-SI.json") => require("./bundles/bundle.l10n.sl-SI.json"),
);
export const sr_Cyrl_RS: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.sr-Cyrl-RS.json") => require("./bundles/bundle.l10n.sr-Cyrl-RS.json"),
);
export const sr_Latn_RS: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.sr-Latn-RS.json") => require("./bundles/bundle.l10n.sr-Latn-RS.json"),
);
export const sv_SE: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.sv-SE.json") => require("./bundles/bundle.l10n.sv-SE.json"),
);
export const th_TH: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.th-TH.json") => require("./bundles/bundle.l10n.th-TH.json"),
);
export const tr_TR: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.tr-TR.json") => require("./bundles/bundle.l10n.tr-TR.json"),
);
export const uk_UA: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.uk-UA.json") => require("./bundles/bundle.l10n.uk-UA.json"),
);
export const vi_VN: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.vi-VN.json") => require("./bundles/bundle.l10n.vi-VN.json"),
);
export const zh_CN: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.zh-CN.json") => require("./bundles/bundle.l10n.zh-CN.json"),
);
export const zh_TW: typeof defaultTemplates = createLazyTemplates(
    defaultTemplates,
    (): typeof import("./bundles/bundle.l10n.zh-TW.json") => require("./bundles/bundle.l10n.zh-TW.json"),
);

export const TemplatesByLocale: Map<string, ILocalizationTemplates> = new Map([
    [PQP.Locale.bg_BG.toLowerCase(), bg_BG],
    [PQP.Locale.ca_ES.toLowerCase(), ca_ES],
    [PQP.Locale.cs_CZ.toLowerCase(), cs_CZ],
    [PQP.Locale.da_DK.toLowerCase(), da_DK],
    [PQP.Locale.de_DE.toLowerCase(), de_DE],
    [PQP.Locale.el_GR.toLowerCase(), el_GR],
    [PQP.Locale.en_US.toLowerCase(), en_US],
    [PQP.Locale.es_ES.toLowerCase(), es_ES],
    [PQP.Locale.et_EE.toLowerCase(), et_EE],
    [PQP.Locale.eu_ES.toLowerCase(), eu_ES],
    [PQP.Locale.fi_FI.toLowerCase(), fi_FI],
    [PQP.Locale.fr_FR.toLowerCase(), fr_FR],
    [PQP.Locale.gl_ES.toLowerCase(), gl_ES],
    [PQP.Locale.hi_IN.toLowerCase(), hi_IN],
    [PQP.Locale.hr_HR.toLowerCase(), hr_HR],
    [PQP.Locale.hu_HU.toLowerCase(), hu_HU],
    [PQP.Locale.id_ID.toLowerCase(), id_ID],
    [PQP.Locale.it_IT.toLowerCase(), it_IT],
    [PQP.Locale.ja_JP.toLowerCase(), ja_JP],
    [PQP.Locale.kk_KZ.toLowerCase(), kk_KZ],
    [PQP.Locale.ko_KR.toLowerCase(), ko_KR],
    [PQP.Locale.lt_LT.toLowerCase(), lt_LT],
    [PQP.Locale.lv_LV.toLowerCase(), lv_LV],
    [PQP.Locale.ms_MY.toLowerCase(), ms_MY],
    [PQP.Locale.nb_NO.toLowerCase(), nb_NO],
    [PQP.Locale.nl_NL.toLowerCase(), nl_NL],
    [PQP.Locale.pl_PL.toLowerCase(), pl_PL],
    [PQP.Locale.pt_BR.toLowerCase(), pt_BR],
    [PQP.Locale.pt_PT.toLowerCase(), pt_PT],
    [PQP.Locale.ro_RO.toLowerCase(), ro_RO],
    [PQP.Locale.ru_RU.toLowerCase(), ru_RU],
    [PQP.Locale.sk_SK.toLowerCase(), sk_SK],
    [PQP.Locale.sl_SI.toLowerCase(), sl_SI],
    [PQP.Locale.sr_Cyrl_RS.toLowerCase(), sr_Cyrl_RS],
    [PQP.Locale.sr_Latn_RS.toLowerCase(), sr_Latn_RS],
    [PQP.Locale.sv_SE.toLowerCase(), sv_SE],
    [PQP.Locale.th_TH.toLowerCase(), th_TH],
    [PQP.Locale.tr_TR.toLowerCase(), tr_TR],
    [PQP.Locale.uk_UA.toLowerCase(), uk_UA],
    [PQP.Locale.vi_VN.toLowerCase(), vi_VN],
    [PQP.Locale.zh_CN.toLowerCase(), zh_CN],
    [PQP.Locale.zh_TW.toLowerCase(), zh_TW],
]);

export interface ILocalizationTemplates {
    readonly error_validation_duplicate_identifier: string;
    readonly error_validation_invokeExpression_typeMismatch_named: string;
    readonly error_validation_invokeExpression_typeMismatch_unnamed: string;
    readonly error_validation_invokeExpression_missingMandatory_named: string;
    readonly error_validation_invokeExpression_missingMandatory_unnamed: string;
    readonly error_validation_invokeExpression_numArgs: string;
    readonly error_validation_unknownIdentifier_noSuggestion: string;
    readonly error_validation_unknownIdentifier_suggestion: string;
    readonly parameterDocumentation_default: string;
    readonly parameterDocumentation_allowedValues: string;
    readonly parameterDocumentation_sampleValues: string;
    readonly parameterDocumentation_type: string;
}

export const DefaultTemplates: ILocalizationTemplates = en_US;

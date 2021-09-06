import * as PQP from "@microsoft/powerquery-parser";

import * as bg_BG from "./templates/templates.bg-BG.json";
import * as ca_ES from "./templates/templates.ca-ES.json";
import * as cs_CZ from "./templates/templates.cs-CZ.json";
import * as da_DK from "./templates/templates.da-DK.json";
import * as de_DE from "./templates/templates.de-DE.json";
import * as el_GR from "./templates/templates.el-GR.json";
import * as es_ES from "./templates/templates.es-ES.json";
import * as et_EE from "./templates/templates.et-EE.json";
import * as eu_ES from "./templates/templates.eu-ES.json";
import * as fi_FI from "./templates/templates.fi-FI.json";
import * as fr_FR from "./templates/templates.fr-FR.json";
import * as gl_ES from "./templates/templates.gl-ES.json";
import * as hi_IN from "./templates/templates.hi-IN.json";
import * as hr_HR from "./templates/templates.hr-HR.json";
import * as hu_HU from "./templates/templates.hu-HU.json";
import * as id_ID from "./templates/templates.id-ID.json";
import * as it_IT from "./templates/templates.it-IT.json";
import * as ja_JP from "./templates/templates.ja-JP.json";
import * as en_US from "./templates/templates.json";
import * as kk_KZ from "./templates/templates.kk-KZ.json";
import * as ko_KR from "./templates/templates.ko-KR.json";
import * as lt_LT from "./templates/templates.lt-LT.json";
import * as lv_LV from "./templates/templates.lv-LV.json";
import * as ms_MY from "./templates/templates.ms-MY.json";
import * as nb_NO from "./templates/templates.nb-NO.json";
import * as nl_NL from "./templates/templates.nl-NL.json";
import * as pl_PL from "./templates/templates.pl-PL.json";
import * as pt_BR from "./templates/templates.pt-BR.json";
import * as pt_PT from "./templates/templates.pt-PT.json";
import * as ro_RO from "./templates/templates.ro-RO.json";
import * as ru_RU from "./templates/templates.ru-RU.json";
import * as sk_SK from "./templates/templates.sk-SK.json";
import * as sl_SI from "./templates/templates.sl-SI.json";
import * as sr_Cyrl_RS from "./templates/templates.sr-Cyrl-RS.json";
import * as sr_Latn_RS from "./templates/templates.sr-Latn-RS.json";
import * as sv_SE from "./templates/templates.sv-SE.json";
import * as th_TH from "./templates/templates.th-TH.json";
import * as tr_TR from "./templates/templates.tr-TR.json";
import * as uk_UA from "./templates/templates.uk-UA.json";
import * as vi_VN from "./templates/templates.vi-VN.json";
import * as zh_CN from "./templates/templates.zh-CN.json";
import * as zh_TW from "./templates/templates.zh-TW.json";

export {
    bg_BG,
    ca_ES,
    cs_CZ,
    da_DK,
    de_DE,
    el_GR,
    en_US,
    es_ES,
    et_EE,
    eu_ES,
    fi_FI,
    fr_FR,
    gl_ES,
    hi_IN,
    hr_HR,
    hu_HU,
    id_ID,
    it_IT,
    ja_JP,
    kk_KZ,
    ko_KR,
    lt_LT,
    lv_LV,
    ms_MY,
    nb_NO,
    nl_NL,
    pl_PL,
    pt_BR,
    pt_PT,
    ro_RO,
    ru_RU,
    sk_SK,
    sl_SI,
    sr_Cyrl_RS,
    sr_Latn_RS,
    sv_SE,
    th_TH,
    tr_TR,
    uk_UA,
    vi_VN,
    zh_CN,
    zh_TW,
};

export const TemplatesByLocale: Map<string, ILocalizationTemplates> = new Map([
    [PQP.Locale.bg_BG.toLowerCase(), bg_BG],
    [PQP.Locale.ca_EZ.toLowerCase(), ca_ES],
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
    readonly error_validation_duplicate_parameter_name: string;
    readonly error_validation_invokeExpression_typeMismatch_named: string;
    readonly error_validation_invokeExpression_typeMismatch_unnamed: string;
    readonly error_validation_invokeExpression_missingMandatory_named: string;
    readonly error_validation_invokeExpression_missingMandatory_unnamed: string;
    readonly error_validation_invokeExpression_numArgs: string;
}

export const DefaultTemplates: ILocalizationTemplates = en_US;

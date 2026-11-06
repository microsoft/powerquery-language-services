import * as PQP from "@microsoft/powerquery-parser";
import { createTemplates } from "@microsoft/powerquery-parser/lib/powerquery-parser/localization/templateUtils";

import bg_BGBundle from "./bundles/bundle.l10n.bg-BG.json";
import ca_ESBundle from "./bundles/bundle.l10n.ca-ES.json";
import cs_CZBundle from "./bundles/bundle.l10n.cs-CZ.json";
import da_DKBundle from "./bundles/bundle.l10n.da-DK.json";
import de_DEBundle from "./bundles/bundle.l10n.de-DE.json";
import defaultBundle from "./bundles/bundle.l10n.json";
import defaultTemplates from "./templates/templates.json";
import el_GRBundle from "./bundles/bundle.l10n.el-GR.json";
import es_ESBundle from "./bundles/bundle.l10n.es-ES.json";
import et_EEBundle from "./bundles/bundle.l10n.et-EE.json";
import eu_ESBundle from "./bundles/bundle.l10n.eu-ES.json";
import fi_FIBundle from "./bundles/bundle.l10n.fi-FI.json";
import fr_FRBundle from "./bundles/bundle.l10n.fr-FR.json";
import gl_ESBundle from "./bundles/bundle.l10n.gl-ES.json";
import hi_INBundle from "./bundles/bundle.l10n.hi-IN.json";
import hr_HRBundle from "./bundles/bundle.l10n.hr-HR.json";
import hu_HUBundle from "./bundles/bundle.l10n.hu-HU.json";
import id_IDBundle from "./bundles/bundle.l10n.id-ID.json";
import it_ITBundle from "./bundles/bundle.l10n.it-IT.json";
import ja_JPBundle from "./bundles/bundle.l10n.ja-JP.json";
import kk_KZBundle from "./bundles/bundle.l10n.kk-KZ.json";
import ko_KRBundle from "./bundles/bundle.l10n.ko-KR.json";
import lt_LTBundle from "./bundles/bundle.l10n.lt-LT.json";
import lv_LVBundle from "./bundles/bundle.l10n.lv-LV.json";
import ms_MYBundle from "./bundles/bundle.l10n.ms-MY.json";
import nb_NOBundle from "./bundles/bundle.l10n.nb-NO.json";
import nl_NLBundle from "./bundles/bundle.l10n.nl-NL.json";
import pl_PLBundle from "./bundles/bundle.l10n.pl-PL.json";
import pt_BRBundle from "./bundles/bundle.l10n.pt-BR.json";
import pt_PTBundle from "./bundles/bundle.l10n.pt-PT.json";
import ro_ROBundle from "./bundles/bundle.l10n.ro-RO.json";
import ru_RUBundle from "./bundles/bundle.l10n.ru-RU.json";
import sk_SKBundle from "./bundles/bundle.l10n.sk-SK.json";
import sl_SIBundle from "./bundles/bundle.l10n.sl-SI.json";
import sr_Cyrl_RSBundle from "./bundles/bundle.l10n.sr-Cyrl-RS.json";
import sr_Latn_RSBundle from "./bundles/bundle.l10n.sr-Latn-RS.json";
import sv_SEBundle from "./bundles/bundle.l10n.sv-SE.json";
import th_THBundle from "./bundles/bundle.l10n.th-TH.json";
import tr_TRBundle from "./bundles/bundle.l10n.tr-TR.json";
import uk_UABundle from "./bundles/bundle.l10n.uk-UA.json";
import vi_VNBundle from "./bundles/bundle.l10n.vi-VN.json";
import zh_CNBundle from "./bundles/bundle.l10n.zh-CN.json";
import zh_TWBundle from "./bundles/bundle.l10n.zh-TW.json";

export const en_US: typeof defaultTemplates = createTemplates(defaultTemplates, defaultBundle);
export const bg_BG: typeof defaultTemplates = createTemplates(defaultTemplates, bg_BGBundle);
export const ca_ES: typeof defaultTemplates = createTemplates(defaultTemplates, ca_ESBundle);
export const cs_CZ: typeof defaultTemplates = createTemplates(defaultTemplates, cs_CZBundle);
export const da_DK: typeof defaultTemplates = createTemplates(defaultTemplates, da_DKBundle);
export const de_DE: typeof defaultTemplates = createTemplates(defaultTemplates, de_DEBundle);
export const el_GR: typeof defaultTemplates = createTemplates(defaultTemplates, el_GRBundle);
export const es_ES: typeof defaultTemplates = createTemplates(defaultTemplates, es_ESBundle);
export const et_EE: typeof defaultTemplates = createTemplates(defaultTemplates, et_EEBundle);
export const eu_ES: typeof defaultTemplates = createTemplates(defaultTemplates, eu_ESBundle);
export const fi_FI: typeof defaultTemplates = createTemplates(defaultTemplates, fi_FIBundle);
export const fr_FR: typeof defaultTemplates = createTemplates(defaultTemplates, fr_FRBundle);
export const gl_ES: typeof defaultTemplates = createTemplates(defaultTemplates, gl_ESBundle);
export const hi_IN: typeof defaultTemplates = createTemplates(defaultTemplates, hi_INBundle);
export const hr_HR: typeof defaultTemplates = createTemplates(defaultTemplates, hr_HRBundle);
export const hu_HU: typeof defaultTemplates = createTemplates(defaultTemplates, hu_HUBundle);
export const id_ID: typeof defaultTemplates = createTemplates(defaultTemplates, id_IDBundle);
export const it_IT: typeof defaultTemplates = createTemplates(defaultTemplates, it_ITBundle);
export const ja_JP: typeof defaultTemplates = createTemplates(defaultTemplates, ja_JPBundle);
export const kk_KZ: typeof defaultTemplates = createTemplates(defaultTemplates, kk_KZBundle);
export const ko_KR: typeof defaultTemplates = createTemplates(defaultTemplates, ko_KRBundle);
export const lt_LT: typeof defaultTemplates = createTemplates(defaultTemplates, lt_LTBundle);
export const lv_LV: typeof defaultTemplates = createTemplates(defaultTemplates, lv_LVBundle);
export const ms_MY: typeof defaultTemplates = createTemplates(defaultTemplates, ms_MYBundle);
export const nb_NO: typeof defaultTemplates = createTemplates(defaultTemplates, nb_NOBundle);
export const nl_NL: typeof defaultTemplates = createTemplates(defaultTemplates, nl_NLBundle);
export const pl_PL: typeof defaultTemplates = createTemplates(defaultTemplates, pl_PLBundle);
export const pt_BR: typeof defaultTemplates = createTemplates(defaultTemplates, pt_BRBundle);
export const pt_PT: typeof defaultTemplates = createTemplates(defaultTemplates, pt_PTBundle);
export const ro_RO: typeof defaultTemplates = createTemplates(defaultTemplates, ro_ROBundle);
export const ru_RU: typeof defaultTemplates = createTemplates(defaultTemplates, ru_RUBundle);
export const sk_SK: typeof defaultTemplates = createTemplates(defaultTemplates, sk_SKBundle);
export const sl_SI: typeof defaultTemplates = createTemplates(defaultTemplates, sl_SIBundle);
export const sr_Cyrl_RS: typeof defaultTemplates = createTemplates(defaultTemplates, sr_Cyrl_RSBundle);
export const sr_Latn_RS: typeof defaultTemplates = createTemplates(defaultTemplates, sr_Latn_RSBundle);
export const sv_SE: typeof defaultTemplates = createTemplates(defaultTemplates, sv_SEBundle);
export const th_TH: typeof defaultTemplates = createTemplates(defaultTemplates, th_THBundle);
export const tr_TR: typeof defaultTemplates = createTemplates(defaultTemplates, tr_TRBundle);
export const uk_UA: typeof defaultTemplates = createTemplates(defaultTemplates, uk_UABundle);
export const vi_VN: typeof defaultTemplates = createTemplates(defaultTemplates, vi_VNBundle);
export const zh_CN: typeof defaultTemplates = createTemplates(defaultTemplates, zh_CNBundle);
export const zh_TW: typeof defaultTemplates = createTemplates(defaultTemplates, zh_TWBundle);

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

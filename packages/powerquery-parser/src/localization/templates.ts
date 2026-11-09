// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import defaultBundle from "./bundles/bundle.l10n.json";

import { createLazyTemplates, createTemplates } from "./templateUtils";
import { Locale } from "./locale";

type TemplateMessageKey = keyof ILocalizationTemplates;
type DefaultTemplateKey = TemplateMessageKey | `_${TemplateMessageKey}.comment`;
type DefaultTemplateShape = { [K in DefaultTemplateKey]: string };

const defaultTemplates: DefaultTemplateShape = {
    error_common_cancellationError: defaultBundle["CancellationError: {reason}"].message,
    "_error_common_cancellationError.comment": defaultBundle["CancellationError: {reason}"].comment.join(""),
    error_common_invariantError_1_details: defaultBundle["InvariantError: {invariantBroken} - {details}"].message,
    "_error_common_invariantError_1_details.comment":
        defaultBundle["InvariantError: {invariantBroken} - {details}"].comment.join(""),
    error_common_invariantError_2_noDetails: defaultBundle["InvariantError: {invariantBroken}"].message,
    "_error_common_invariantError_2_noDetails.comment":
        defaultBundle["InvariantError: {invariantBroken}"].comment.join(""),
    error_common_unknown: defaultBundle["An unknown error was encountered, innerError: {innerError}"].message,
    "_error_common_unknown.comment":
        defaultBundle["An unknown error was encountered, innerError: {innerError}"].comment.join(""),
    error_lex_endOfStreamPartwayRead:
        defaultBundle["While attempting to read a token the document stream ended part way through"].message,
    "_error_lex_endOfStreamPartwayRead.comment":
        defaultBundle["While attempting to read a token the document stream ended part way through"].comment.join(""),
    error_lex_expectedKind_1_hex: defaultBundle["Expected a hex literal"].message,
    "_error_lex_expectedKind_1_hex.comment": defaultBundle["Expected a hex literal"].comment.join(""),
    error_lex_expectedKind_2_keywordOrIdentifier: defaultBundle["Expected a keyword or identifier"].message,
    "_error_lex_expectedKind_2_keywordOrIdentifier.comment":
        defaultBundle["Expected a keyword or identifier"].comment.join(""),
    error_lex_expectedKind_3_numeric: defaultBundle["Expected a numeric literal"].message,
    "_error_lex_expectedKind_3_numeric.comment": defaultBundle["Expected a numeric literal"].comment.join(""),
    error_lex_unexpectedRead: defaultBundle["Unexpected read during tokenization"].message,
    "_error_lex_unexpectedRead.comment": defaultBundle["Unexpected read during tokenization"].comment.join(""),
    error_lex_unterminatedMultilineToken_1_comment: defaultBundle["Unterminated multiline comment"].message,
    "_error_lex_unterminatedMultilineToken_1_comment.comment":
        defaultBundle["Unterminated multiline comment"].comment.join(""),
    error_lex_unterminatedMultilineToken_2_quotedIdentifier: defaultBundle["Unterminated quoted identifier"].message,
    "_error_lex_unterminatedMultilineToken_2_quotedIdentifier.comment":
        defaultBundle["Unterminated quoted identifier"].comment.join(""),
    error_lex_unterminatedMultilineToken_3_string: defaultBundle["Unterminated string"].message,
    "_error_lex_unterminatedMultilineToken_3_string.comment": defaultBundle["Unterminated string"].comment.join(""),
    error_parse_csvContinuation_1_danglingComma: defaultBundle["Did you leave a dangling comma?"].message,
    "_error_parse_csvContinuation_1_danglingComma.comment":
        defaultBundle["Did you leave a dangling comma?"].comment.join(""),
    error_parse_csvContinuation_2_letExpression: defaultBundle["A comma cannot proceed an 'in'"].message,
    "_error_parse_csvContinuation_2_letExpression.comment":
        defaultBundle["A comma cannot proceed an 'in'"].comment.join(""),
    error_parse_expectAnyTokenKind_1_other:
        defaultBundle[
            "Expected to find one of the following, but a {foundTokenKind} was found instead: {expectedAnyTokenKinds}"
        ].message,
    "_error_parse_expectAnyTokenKind_1_other.comment":
        defaultBundle[
            "Expected to find one of the following, but a {foundTokenKind} was found instead: {expectedAnyTokenKinds}"
        ].comment.join(""),
    error_parse_expectAnyTokenKind_2_endOfStream:
        defaultBundle[
            "Expected to find one of the following, but the end-of-stream was reached instead: {expectedAnyTokenKinds}"
        ].message,
    "_error_parse_expectAnyTokenKind_2_endOfStream.comment":
        defaultBundle[
            "Expected to find one of the following, but the end-of-stream was reached instead: {expectedAnyTokenKinds}"
        ].comment.join(""),
    error_parse_expectedCommaOrTokenKind:
        defaultBundle["Expected to find either a {localizedComma} or {localizedAlternative}."].message,
    "_error_parse_expectedCommaOrTokenKind.comment":
        defaultBundle["Expected to find either a {localizedComma} or {localizedAlternative}."].comment.join(""),
    error_parse_expectGeneralizedIdentifier_1_other: defaultBundle["Expected to find a generalized identifier"].message,
    "_error_parse_expectGeneralizedIdentifier_1_other.comment":
        defaultBundle["Expected to find a generalized identifier"].comment.join(""),
    error_parse_expectGeneralizedIdentifier_2_endOfStream:
        defaultBundle["Expected to find a generalized identifier but the end-of-stream was reached first"].message,
    "_error_parse_expectGeneralizedIdentifier_2_endOfStream.comment":
        defaultBundle["Expected to find a generalized identifier but the end-of-stream was reached first"].comment.join(
            "",
        ),
    error_parse_expectTokenKind_1_other:
        defaultBundle["Expected to find a {expectedTokenKind}, but a {foundTokenKind} was found instead"].message,
    "_error_parse_expectTokenKind_1_other.comment":
        defaultBundle["Expected to find a {expectedTokenKind}, but a {foundTokenKind} was found instead"].comment.join(
            "",
        ),
    error_parse_expectTokenKind_2_endOfStream:
        defaultBundle["Expected to find a {expectedTokenKind}, but the end-of-stream was reached instead"].message,
    "_error_parse_expectTokenKind_2_endOfStream.comment":
        defaultBundle["Expected to find a {expectedTokenKind}, but the end-of-stream was reached instead"].comment.join(
            "",
        ),
    error_parse_invalidCatchFunction:
        defaultBundle[
            "The 'catch' clause of a try/catch expression must be followed by a function definition with 0 or 1 arguments and no type constraints"
        ].message,
    "_error_parse_invalidCatchFunction.comment":
        defaultBundle[
            "The 'catch' clause of a try/catch expression must be followed by a function definition with 0 or 1 arguments and no type constraints"
        ].comment.join(""),
    error_parse_invalidPrimitiveType:
        defaultBundle["Expected to find a primitive literal, but a {foundTokenKind} was found instead"].message,
    "_error_parse_invalidPrimitiveType.comment":
        defaultBundle["Expected to find a primitive literal, but a {foundTokenKind} was found instead"].comment.join(
            "",
        ),
    error_parse_requiredParameterAfterOptional:
        defaultBundle["You cannot have a non-optional parameter after an optional parameter"].message,
    "_error_parse_requiredParameterAfterOptional.comment":
        defaultBundle["You cannot have a non-optional parameter after an optional parameter"].comment.join(""),
    error_parse_unterminated_sequence_bracket: defaultBundle["Unterminated bracket"].message,
    "_error_parse_unterminated_sequence_bracket.comment": defaultBundle["Unterminated bracket"].comment.join(""),
    error_parse_unterminated_sequence_parenthesis: defaultBundle["Unterminated parenthesis"].message,
    "_error_parse_unterminated_sequence_parenthesis.comment":
        defaultBundle["Unterminated parenthesis"].comment.join(""),
    error_parse_unusedTokens: defaultBundle["Finished parsing but more tokens remain"].message,
    "_error_parse_unusedTokens.comment": defaultBundle["Finished parsing but more tokens remain"].comment.join(""),
    tokenKind_ampersand: defaultBundle["ampersand <'&'>"].message,
    "_tokenKind_ampersand.comment": defaultBundle["ampersand <'&'>"].comment.join(""),
    tokenKind_asterisk: defaultBundle["asterisk <'*'>"].message,
    "_tokenKind_asterisk.comment": defaultBundle["asterisk <'*'>"].comment.join(""),
    tokenKind_atSign: defaultBundle["at sign <'@'>"].message,
    "_tokenKind_atSign.comment": defaultBundle["at sign <'@'>"].comment.join(""),
    tokenKind_bang: defaultBundle["exclamation mark <'!'>"].message,
    "_tokenKind_bang.comment": defaultBundle["exclamation mark <'!'>"].comment.join(""),
    tokenKind_comma: defaultBundle["comma <','>"].message,
    "_tokenKind_comma.comment": defaultBundle["comma <','>"].comment.join(""),
    tokenKind_division: defaultBundle["division operator <'/'>"].message,
    "_tokenKind_division.comment": defaultBundle["division operator <'/'>"].comment.join(""),
    tokenKind_dotDot: defaultBundle["dot dot <'..'>"].message,
    "_tokenKind_dotDot.comment": defaultBundle["dot dot <'..'>"].comment.join(""),
    tokenKind_ellipsis: defaultBundle["ellipsis <'...'>"].message,
    "_tokenKind_ellipsis.comment": defaultBundle["ellipsis <'...'>"].comment.join(""),
    tokenKind_equal: defaultBundle["equal operator <'='>"].message,
    "_tokenKind_equal.comment": defaultBundle["equal operator <'='>"].comment.join(""),
    tokenKind_fatArrow: defaultBundle["goes to ('=>')"].message,
    "_tokenKind_fatArrow.comment": defaultBundle["goes to ('=>')"].comment.join(""),
    tokenKind_greaterThan: defaultBundle["greater than operator ('>')"].message,
    "_tokenKind_greaterThan.comment": defaultBundle["greater than operator ('>')"].comment.join(""),
    tokenKind_greaterThanEqualTo: defaultBundle["greater than or equal to operator ('>=')"].message,
    "_tokenKind_greaterThanEqualTo.comment": defaultBundle["greater than or equal to operator ('>=')"].comment.join(""),
    tokenKind_hexLiteral: defaultBundle["hex literal"].message,
    "_tokenKind_hexLiteral.comment": defaultBundle["hex literal"].comment.join(""),
    tokenKind_identifier: defaultBundle["identifier"].message,
    "_tokenKind_identifier.comment": defaultBundle["identifier"].comment.join(""),
    tokenKind_keywordAnd: defaultBundle["keyword <'and'>"].message,
    "_tokenKind_keywordAnd.comment": defaultBundle["keyword <'and'>"].comment.join(""),
    tokenKind_keywordAs: defaultBundle["keyword <'as'>"].message,
    "_tokenKind_keywordAs.comment": defaultBundle["keyword <'as'>"].comment.join(""),
    tokenKind_keywordEach: defaultBundle["keyword <'each'>"].message,
    "_tokenKind_keywordEach.comment": defaultBundle["keyword <'each'>"].comment.join(""),
    tokenKind_keywordElse: defaultBundle["keyword <'else'>"].message,
    "_tokenKind_keywordElse.comment": defaultBundle["keyword <'else'>"].comment.join(""),
    tokenKind_keywordError: defaultBundle["keyword <'error'>"].message,
    "_tokenKind_keywordError.comment": defaultBundle["keyword <'error'>"].comment.join(""),
    tokenKind_keywordFalse: defaultBundle["keyword <'false'>"].message,
    "_tokenKind_keywordFalse.comment": defaultBundle["keyword <'false'>"].comment.join(""),
    tokenKind_keywordHashBinary: defaultBundle["keyword <'#binary'>"].message,
    "_tokenKind_keywordHashBinary.comment": defaultBundle["keyword <'#binary'>"].comment.join(""),
    tokenKind_keywordHashDate: defaultBundle["keyword <'#date'>"].message,
    "_tokenKind_keywordHashDate.comment": defaultBundle["keyword <'#date'>"].comment.join(""),
    tokenKind_keywordHashDateTime: defaultBundle["keyword <'#datetime'>"].message,
    "_tokenKind_keywordHashDateTime.comment": defaultBundle["keyword <'#datetime'>"].comment.join(""),
    tokenKind_keywordHashDateTimeZone: defaultBundle["keyword <'#datetimezone'>"].message,
    "_tokenKind_keywordHashDateTimeZone.comment": defaultBundle["keyword <'#datetimezone'>"].comment.join(""),
    tokenKind_keywordHashDuration: defaultBundle["keyword <'#duration'>"].message,
    "_tokenKind_keywordHashDuration.comment": defaultBundle["keyword <'#duration'>"].comment.join(""),
    tokenKind_keywordHashInfinity: defaultBundle["keyword <'#infinity'>"].message,
    "_tokenKind_keywordHashInfinity.comment": defaultBundle["keyword <'#infinity'>"].comment.join(""),
    tokenKind_keywordHashNan: defaultBundle["keyword <'#nan'>"].message,
    "_tokenKind_keywordHashNan.comment": defaultBundle["keyword <'#nan'>"].comment.join(""),
    tokenKind_keywordHashSections: defaultBundle["keyword <'#sections'>"].message,
    "_tokenKind_keywordHashSections.comment": defaultBundle["keyword <'#sections'>"].comment.join(""),
    tokenKind_keywordHashShared: defaultBundle["keyword <'#shared'>"].message,
    "_tokenKind_keywordHashShared.comment": defaultBundle["keyword <'#shared'>"].comment.join(""),
    tokenKind_keywordHashTable: defaultBundle["keyword <'#table'>"].message,
    "_tokenKind_keywordHashTable.comment": defaultBundle["keyword <'#table'>"].comment.join(""),
    tokenKind_keywordHashTime: defaultBundle["keyword <'#time'>"].message,
    "_tokenKind_keywordHashTime.comment": defaultBundle["keyword <'#time'>"].comment.join(""),
    tokenKind_keywordIf: defaultBundle["keyword <'if'>"].message,
    "_tokenKind_keywordIf.comment": defaultBundle["keyword <'if'>"].comment.join(""),
    tokenKind_keywordIn: defaultBundle["keyword <'in'>"].message,
    "_tokenKind_keywordIn.comment": defaultBundle["keyword <'in'>"].comment.join(""),
    tokenKind_keywordIs: defaultBundle["keyword <'is'>"].message,
    "_tokenKind_keywordIs.comment": defaultBundle["keyword <'is'>"].comment.join(""),
    tokenKind_keywordLet: defaultBundle["keyword <'let'>"].message,
    "_tokenKind_keywordLet.comment": defaultBundle["keyword <'let'>"].comment.join(""),
    tokenKind_keywordMeta: defaultBundle["keyword <'meta'>"].message,
    "_tokenKind_keywordMeta.comment": defaultBundle["keyword <'meta'>"].comment.join(""),
    tokenKind_keywordNot: defaultBundle["keyword <'not'>"].message,
    "_tokenKind_keywordNot.comment": defaultBundle["keyword <'not'>"].comment.join(""),
    tokenKind_keywordOr: defaultBundle["keyword <'or'>"].message,
    "_tokenKind_keywordOr.comment": defaultBundle["keyword <'or'>"].comment.join(""),
    tokenKind_keywordOtherwise: defaultBundle["keyword <'otherwise'>"].message,
    "_tokenKind_keywordOtherwise.comment": defaultBundle["keyword <'otherwise'>"].comment.join(""),
    tokenKind_keywordSection: defaultBundle["keyword <'section'>"].message,
    "_tokenKind_keywordSection.comment": defaultBundle["keyword <'section'>"].comment.join(""),
    tokenKind_keywordShared: defaultBundle["keyword <'shared'>"].message,
    "_tokenKind_keywordShared.comment": defaultBundle["keyword <'shared'>"].comment.join(""),
    tokenKind_keywordThen: defaultBundle["keyword <'then'>"].message,
    "_tokenKind_keywordThen.comment": defaultBundle["keyword <'then'>"].comment.join(""),
    tokenKind_keywordTrue: defaultBundle["keyword <'true'>"].message,
    "_tokenKind_keywordTrue.comment": defaultBundle["keyword <'true'>"].comment.join(""),
    tokenKind_keywordTry: defaultBundle["keyword <'try'>"].message,
    "_tokenKind_keywordTry.comment": defaultBundle["keyword <'try'>"].comment.join(""),
    tokenKind_keywordType: defaultBundle["keyword <'type'>"].message,
    "_tokenKind_keywordType.comment": defaultBundle["keyword <'type'>"].comment.join(""),
    tokenKind_leftBrace: defaultBundle["left brace <'{'>"].message,
    "_tokenKind_leftBrace.comment": defaultBundle["left brace <'{'>"].comment.join(""),
    tokenKind_leftBracket: defaultBundle["left bracket <'['>"].message,
    "_tokenKind_leftBracket.comment": defaultBundle["left bracket <'['>"].comment.join(""),
    tokenKind_leftParenthesis: defaultBundle["left parenthesis <'('>"].message,
    "_tokenKind_leftParenthesis.comment": defaultBundle["left parenthesis <'('>"].comment.join(""),
    tokenKind_lessThan: defaultBundle["less than operator ('<')"].message,
    "_tokenKind_lessThan.comment": defaultBundle["less than operator ('<')"].comment.join(""),
    tokenKind_lessThanEqualTo: defaultBundle["less than or equal to operator ('<=')"].message,
    "_tokenKind_lessThanEqualTo.comment": defaultBundle["less than or equal to operator ('<=')"].comment.join(""),
    tokenKind_minus: defaultBundle["minus <'-'>"].message,
    "_tokenKind_minus.comment": defaultBundle["minus <'-'>"].comment.join(""),
    tokenKind_notEqual: defaultBundle["not equal to operator ('<>')"].message,
    "_tokenKind_notEqual.comment": defaultBundle["not equal to operator ('<>')"].comment.join(""),
    tokenKind_nullCoalescingOperator: defaultBundle["null coalescing operator <'??'>"].message,
    "_tokenKind_nullCoalescingOperator.comment": defaultBundle["null coalescing operator <'??'>"].comment.join(""),
    tokenKind_nullLiteral: defaultBundle["<'null'>"].message,
    "_tokenKind_nullLiteral.comment": defaultBundle["<'null'>"].comment.join(""),
    tokenKind_numericLiteral: defaultBundle["numeric literal"].message,
    "_tokenKind_numericLiteral.comment": defaultBundle["numeric literal"].comment.join(""),
    tokenKind_plus: defaultBundle["addition operator <'+'>"].message,
    "_tokenKind_plus.comment": defaultBundle["addition operator <'+'>"].comment.join(""),
    tokenKind_questionMark: defaultBundle["question mark <'?'>"].message,
    "_tokenKind_questionMark.comment": defaultBundle["question mark <'?'>"].comment.join(""),
    tokenKind_rightBrace: defaultBundle["right brace <'}'>"].message,
    "_tokenKind_rightBrace.comment": defaultBundle["right brace <'}'>"].comment.join(""),
    tokenKind_rightBracket: defaultBundle["right bracket <']'>"].message,
    "_tokenKind_rightBracket.comment": defaultBundle["right bracket <']'>"].comment.join(""),
    tokenKind_rightParenthesis: defaultBundle["right parenthesis <')'>"].message,
    "_tokenKind_rightParenthesis.comment": defaultBundle["right parenthesis <')'>"].comment.join(""),
    tokenKind_semicolon: defaultBundle["semicolon <';'>"].message,
    "_tokenKind_semicolon.comment": defaultBundle["semicolon <';'>"].comment.join(""),
    tokenKind_textLiteral: defaultBundle["text"].message,
    "_tokenKind_textLiteral.comment": defaultBundle["text"].comment.join(""),
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
    [Locale.bg_BG.toLowerCase(), bg_BG],
    [Locale.ca_ES.toLowerCase(), ca_ES],
    [Locale.cs_CZ.toLowerCase(), cs_CZ],
    [Locale.da_DK.toLowerCase(), da_DK],
    [Locale.de_DE.toLowerCase(), de_DE],
    [Locale.el_GR.toLowerCase(), el_GR],
    [Locale.en_US.toLowerCase(), en_US],
    [Locale.es_ES.toLowerCase(), es_ES],
    [Locale.et_EE.toLowerCase(), et_EE],
    [Locale.eu_ES.toLowerCase(), eu_ES],
    [Locale.fi_FI.toLowerCase(), fi_FI],
    [Locale.fr_FR.toLowerCase(), fr_FR],
    [Locale.gl_ES.toLowerCase(), gl_ES],
    [Locale.hi_IN.toLowerCase(), hi_IN],
    [Locale.hr_HR.toLowerCase(), hr_HR],
    [Locale.hu_HU.toLowerCase(), hu_HU],
    [Locale.id_ID.toLowerCase(), id_ID],
    [Locale.it_IT.toLowerCase(), it_IT],
    [Locale.ja_JP.toLowerCase(), ja_JP],
    [Locale.kk_KZ.toLowerCase(), kk_KZ],
    [Locale.ko_KR.toLowerCase(), ko_KR],
    [Locale.lt_LT.toLowerCase(), lt_LT],
    [Locale.lv_LV.toLowerCase(), lv_LV],
    [Locale.ms_MY.toLowerCase(), ms_MY],
    [Locale.nb_NO.toLowerCase(), nb_NO],
    [Locale.nl_NL.toLowerCase(), nl_NL],
    [Locale.pl_PL.toLowerCase(), pl_PL],
    [Locale.pt_BR.toLowerCase(), pt_BR],
    [Locale.pt_PT.toLowerCase(), pt_PT],
    [Locale.ro_RO.toLowerCase(), ro_RO],
    [Locale.ru_RU.toLowerCase(), ru_RU],
    [Locale.sk_SK.toLowerCase(), sk_SK],
    [Locale.sl_SI.toLowerCase(), sl_SI],
    [Locale.sr_Cyrl_RS.toLowerCase(), sr_Cyrl_RS],
    [Locale.sr_Latn_RS.toLowerCase(), sr_Latn_RS],
    [Locale.sv_SE.toLowerCase(), sv_SE],
    [Locale.th_TH.toLowerCase(), th_TH],
    [Locale.tr_TR.toLowerCase(), tr_TR],
    [Locale.uk_UA.toLowerCase(), uk_UA],
    [Locale.vi_VN.toLowerCase(), vi_VN],
    [Locale.zh_CN.toLowerCase(), zh_CN],
    [Locale.zh_TW.toLowerCase(), zh_TW],
]);

export interface ILocalizationTemplates {
    readonly error_common_cancellationError: string;
    readonly error_common_invariantError_1_details: string;
    readonly error_common_invariantError_2_noDetails: string;
    readonly error_common_unknown: string;
    readonly error_lex_endOfStreamPartwayRead: string;
    readonly error_lex_expectedKind_1_hex: string;
    readonly error_lex_expectedKind_2_keywordOrIdentifier: string;
    readonly error_lex_expectedKind_3_numeric: string;
    readonly error_lex_unexpectedRead: string;
    readonly error_lex_unterminatedMultilineToken_1_comment: string;
    readonly error_lex_unterminatedMultilineToken_2_quotedIdentifier: string;
    readonly error_lex_unterminatedMultilineToken_3_string: string;
    readonly error_parse_csvContinuation_1_danglingComma: string;
    readonly error_parse_csvContinuation_2_letExpression: string;
    readonly error_parse_expectAnyTokenKind_1_other: string;
    readonly error_parse_expectAnyTokenKind_2_endOfStream: string;
    readonly error_parse_expectedCommaOrTokenKind: string;
    readonly error_parse_expectGeneralizedIdentifier_1_other: string;
    readonly error_parse_expectGeneralizedIdentifier_2_endOfStream: string;
    readonly error_parse_expectTokenKind_1_other: string;
    readonly error_parse_expectTokenKind_2_endOfStream: string;
    readonly error_parse_invalidCatchFunction: string;
    readonly error_parse_invalidPrimitiveType: string;
    readonly error_parse_requiredParameterAfterOptional: string;
    readonly error_parse_unterminated_sequence_bracket: string;
    readonly error_parse_unterminated_sequence_parenthesis: string;
    readonly error_parse_unusedTokens: string;
    readonly tokenKind_ampersand: string;
    readonly tokenKind_asterisk: string;
    readonly tokenKind_atSign: string;
    readonly tokenKind_bang: string;
    readonly tokenKind_comma: string;
    readonly tokenKind_division: string;
    readonly tokenKind_dotDot: string;
    readonly tokenKind_ellipsis: string;
    readonly tokenKind_equal: string;
    readonly tokenKind_fatArrow: string;
    readonly tokenKind_greaterThan: string;
    readonly tokenKind_greaterThanEqualTo: string;
    readonly tokenKind_hexLiteral: string;
    readonly tokenKind_identifier: string;
    readonly tokenKind_keywordAnd: string;
    readonly tokenKind_keywordAs: string;
    readonly tokenKind_keywordEach: string;
    readonly tokenKind_keywordElse: string;
    readonly tokenKind_keywordError: string;
    readonly tokenKind_keywordFalse: string;
    readonly tokenKind_keywordHashBinary: string;
    readonly tokenKind_keywordHashDate: string;
    readonly tokenKind_keywordHashDateTime: string;
    readonly tokenKind_keywordHashDateTimeZone: string;
    readonly tokenKind_keywordHashDuration: string;
    readonly tokenKind_keywordHashInfinity: string;
    readonly tokenKind_keywordHashNan: string;
    readonly tokenKind_keywordHashSections: string;
    readonly tokenKind_keywordHashShared: string;
    readonly tokenKind_keywordHashTable: string;
    readonly tokenKind_keywordHashTime: string;
    readonly tokenKind_keywordIf: string;
    readonly tokenKind_keywordIn: string;
    readonly tokenKind_keywordIs: string;
    readonly tokenKind_keywordLet: string;
    readonly tokenKind_keywordMeta: string;
    readonly tokenKind_keywordNot: string;
    readonly tokenKind_keywordOr: string;
    readonly tokenKind_keywordOtherwise: string;
    readonly tokenKind_keywordSection: string;
    readonly tokenKind_keywordShared: string;
    readonly tokenKind_keywordThen: string;
    readonly tokenKind_keywordTrue: string;
    readonly tokenKind_keywordTry: string;
    readonly tokenKind_keywordType: string;
    readonly tokenKind_leftBrace: string;
    readonly tokenKind_leftBracket: string;
    readonly tokenKind_leftParenthesis: string;
    readonly tokenKind_lessThan: string;
    readonly tokenKind_lessThanEqualTo: string;
    readonly tokenKind_minus: string;
    readonly tokenKind_notEqual: string;
    readonly tokenKind_nullCoalescingOperator: string;
    readonly tokenKind_nullLiteral: string;
    readonly tokenKind_numericLiteral: string;
    readonly tokenKind_plus: string;
    readonly tokenKind_questionMark: string;
    readonly tokenKind_rightBrace: string;
    readonly tokenKind_rightBracket: string;
    readonly tokenKind_rightParenthesis: string;
    readonly tokenKind_semicolon: string;
    readonly tokenKind_textLiteral: string;
}

export const DefaultTemplates: ILocalizationTemplates = en_US;

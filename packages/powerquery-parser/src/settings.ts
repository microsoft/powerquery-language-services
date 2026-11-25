// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CombinatorialParserV2, ParseSettings, ParseState, ParseStateUtils } from "./parser";
import { LexerSnapshot, LexSettings } from "./lexer";
import { DefaultLocale } from "./localization";
import { NoOpTraceManagerInstance } from "./common/trace";
import { ParseBehavior } from "./parser/parseBehavior";

export type Settings = LexSettings & ParseSettings;

export const DefaultSettings: Settings = {
    newParseState: (lexerSnapshot: LexerSnapshot, overrides?: Partial<ParseState>) =>
        ParseStateUtils.newState(lexerSnapshot, overrides),
    locale: DefaultLocale,
    // The lexer and parser create a fresh deadline at the operation boundary.
    cancellationToken: undefined,
    isTypeDirectiveAllowed: false,
    initialCorrelationId: undefined,
    parserEntryPoint: undefined,
    parseBehavior: ParseBehavior.ParseEitherExpressionOrSection,
    parser: CombinatorialParserV2,
    traceManager: NoOpTraceManagerInstance,
};

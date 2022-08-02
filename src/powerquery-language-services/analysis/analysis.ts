// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "@microsoft/powerquery-parser";
import type {
    DocumentSymbol,
    FoldingRange,
    Hover,
    Location,
    Position,
    SignatureHelp,
} from "vscode-languageserver-types";
import { ParseError, ParseState } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { AutocompleteItem, TypeCache } from "../inspection";
import { IDisposable } from "../commonTypes";
import { PartialSemanticToken } from "../providers";
import { TextEdit } from "vscode-languageserver-textdocument";

// All language services related methods are of type Result<T | undefined, CommonError>.
// The type is essentially a trinary type where:
// - Ok(T) means no error occured and the task was completed and returned some result.
// - Ok(undefined) means no error occured but the task couldn't be completed.
//   E.g. if the parse state was never reached.
// - CommonError means some non-recoverable exception was thrown during the execution.
export interface Analysis extends IDisposable {
    getAutocompleteItems(position: Position): Promise<Result<AutocompleteItem[] | undefined, CommonError.CommonError>>;
    getDefinition(position: Position): Promise<Result<Location[] | undefined, CommonError.CommonError>>;
    getDocumentSymbols(): Promise<Result<DocumentSymbol[] | undefined, CommonError.CommonError>>;
    getFoldingRanges(): Promise<Result<FoldingRange[] | undefined, CommonError.CommonError>>;
    getHover(position: Position): Promise<Result<Hover | undefined, CommonError.CommonError>>;
    getPartialSemanticTokens(): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>>;
    getSignatureHelp(position: Position): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>>;
    getRenameEdits(
        position: Position,
        newName: string,
    ): Promise<Result<TextEdit[] | undefined, CommonError.CommonError>>;

    // Helper functions unrelated to the language services.
    getParseError(): Promise<ParseError.ParseError | undefined>;
    getParseState(): Promise<ParseState | undefined>;
    getTypeCache(): TypeCache;
}

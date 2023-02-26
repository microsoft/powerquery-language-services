// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, ICancellationToken, Result } from "@microsoft/powerquery-parser";
import type {
    DocumentSymbol,
    FoldingRange,
    Hover,
    Location,
    Position,
    SignatureHelp,
} from "vscode-languageserver-types";
import { ParseError, ParseState } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { AutocompleteItem, TActiveNode, TypeCache } from "../inspection";
import { IDisposable } from "../commonTypes";
import { PartialSemanticToken } from "../providers";
import { TextEdit } from "vscode-languageserver-textdocument";

// All language services related methods are of type Result<T | undefined, CommonError>.
// The type is essentially a trinary type where:
// - Ok(T) means no error occured and the task was completed and returned some result.
// - Ok(undefined) means no error occured but the task couldn't be completed. E.g. if the parse phase wasn't reached.
// - CommonError means some non-recoverable exception was thrown during the execution.
//
// On instantiation of Analysis it begins lexing and parsing the document.
// All of of the first block of methods optionally take a cancellation token.
// This token will be used instead of the initial cancellation token found in InspectionSettings.
export interface Analysis extends IDisposable {
    getAutocompleteItems(
        position: Position,
        cancellationToken?: ICancellationToken,
    ): Promise<Result<AutocompleteItem[] | undefined, CommonError.CommonError>>;
    getDefinition(
        position: Position,
        cancellationToken?: ICancellationToken,
    ): Promise<Result<Location[] | undefined, CommonError.CommonError>>;
    getDocumentSymbols(
        cancellationToken?: ICancellationToken,
    ): Promise<Result<DocumentSymbol[] | undefined, CommonError.CommonError>>;
    getFoldingRanges(
        cancellationToken?: ICancellationToken,
    ): Promise<Result<FoldingRange[] | undefined, CommonError.CommonError>>;
    getHover(
        position: Position,
        cancellationToken?: ICancellationToken,
    ): Promise<Result<Hover | undefined, CommonError.CommonError>>;
    getPartialSemanticTokens(
        cancellationToken?: ICancellationToken,
    ): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>>;
    getSignatureHelp(
        position: Position,
        cancellationToken?: ICancellationToken,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>>;
    getRenameEdits(
        position: Position,
        newName: string,
        cancellationToken?: ICancellationToken,
    ): Promise<Result<TextEdit[] | undefined, CommonError.CommonError>>;

    // Helper functions unrelated to the language services.
    // They operate on the initial cancellation token found in InspectionSettings.
    getActiveNode(position: Position): Promise<Result<TActiveNode | undefined, CommonError.CommonError>>;
    getParseError(): Promise<Result<ParseError.ParseError | undefined, CommonError.CommonError>>;
    getParseState(): Promise<Result<ParseState | undefined, CommonError.CommonError>>;
    getTypeCache(): TypeCache;
}

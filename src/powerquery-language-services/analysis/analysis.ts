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

    getParseError(): Promise<ParseError.ParseError | undefined>;
    getParseState(): Promise<ParseState | undefined>;
    getTypeCache(): TypeCache;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "@microsoft/powerquery-parser";
import type { FoldingRange, Hover, Location, Position } from "vscode-languageserver-types";

import { AutocompleteItem } from "../inspection";
import { IDisposable } from "../commonTypes";
import { PartialSemanticToken } from "../providers";

export interface Analysis extends IDisposable {
    getAutocompleteItems(position: Position): Promise<Result<AutocompleteItem[] | undefined, CommonError.CommonError>>;
    getDefinition(position: Position): Promise<Result<Location[] | undefined, CommonError.CommonError>>;
    getFoldingRanges(): Promise<Result<FoldingRange[] | undefined, CommonError.CommonError>>;
    getHover(position: Position): Promise<Result<Hover | undefined, CommonError.CommonError>>;
    getPartialSemanticTokens(): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>>;
    // getSignatureHelp(): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>>;
    // getRenameEdits(newName: string): Promise<Result<TextEdit[] | undefined, CommonError.CommonError>>;
}

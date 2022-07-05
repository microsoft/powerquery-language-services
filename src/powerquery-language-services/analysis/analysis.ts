// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Hover, Location, SignatureHelp, TextEdit } from "vscode-languageserver-types";

import { Inspection, PartialSemanticToken } from "..";
import { IDisposable } from "../commonTypes";

export interface Analysis extends IDisposable {
    getAutocompleteItems(): Promise<Inspection.AutocompleteItem[]>;
    getDefinition(): Promise<Location[]>;
    getHover(): Promise<Hover>;
    getPartialSemanticTokens(): Promise<PartialSemanticToken[]>;
    getSignatureHelp(): Promise<SignatureHelp>;
    getRenameEdits(newName: string): Promise<TextEdit[]>;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Hover, SignatureHelp, TextEdit } from "vscode-languageserver-types";

import { IDisposable } from "../commonTypes";
import { Inspection } from "..";

export interface Analysis extends IDisposable {
    getAutocompleteItems(): Promise<Inspection.AutocompleteItem[]>;
    getHover(): Promise<Hover>;
    getSignatureHelp(): Promise<SignatureHelp>;
    getRenameEdits(newName: string): Promise<TextEdit[]>;
}

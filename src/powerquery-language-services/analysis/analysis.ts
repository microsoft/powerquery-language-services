// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Hover, Location, SignatureHelp, TextEdit } from "vscode-languageserver-types";

import { IDisposable } from "../commonTypes";
import { Inspection } from "..";

export interface Analysis extends IDisposable {
    getAutocompleteItems(): Promise<Inspection.AutocompleteItem[]>;
    getDefinition(): Promise<Location[]>;
    getHover(): Promise<Hover>;
    getSignatureHelp(): Promise<SignatureHelp>;
    getRenameEdits(newName: string): Promise<TextEdit[]>;
}

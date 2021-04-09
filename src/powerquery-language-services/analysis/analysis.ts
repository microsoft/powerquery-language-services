// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Hover, SignatureHelp } from "vscode-languageserver-types";
import { Inspection } from "..";

import { IDisposable } from "../commonTypes";

export interface Analysis extends IDisposable {
    getAutocompleteItems(): Promise<Inspection.AutocompleteItem[]>;
    getHover(): Promise<Hover>;
    getSignatureHelp(): Promise<SignatureHelp>;
}

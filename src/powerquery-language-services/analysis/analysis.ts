// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { CompletionItem, Hover, SignatureHelp } from "vscode-languageserver-types";

import { IDisposable } from "../commonTypes";

export interface Analysis extends IDisposable {
    getCompletionItems(): Promise<ReadonlyArray<CompletionItem>>;
    getHover(): Promise<Hover>;
    getSignatureHelp(): Promise<SignatureHelp>;
}

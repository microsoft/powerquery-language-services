// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Diagnostic } from "vscode-languageserver-types";

export interface ValidateOk {
    readonly diagnostics: Diagnostic[];
    readonly hasSyntaxError: boolean;
}

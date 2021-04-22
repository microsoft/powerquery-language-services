import * as PQP from "@microsoft/powerquery-parser";

import type { Diagnostic } from "vscode-languageserver-types";
import type { AnalysisOptions } from "../analysis";

export interface ValidationOptions extends AnalysisOptions {
    readonly source?: string;
    readonly checkForDuplicateIdentifiers?: boolean;
}

export interface ValidationResult {
    readonly diagnostics: Diagnostic[];
    readonly hasSyntaxError: boolean;
}

export interface DiagnosticCheck {
    readonly diagnostics: ReadonlyArray<Diagnostic>;
    readonly maybeParserContextState: PQP.Parser.ParseContext.State | undefined;
}

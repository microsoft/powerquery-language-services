// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TextDocument } from "vscode-languageserver-textdocument";

export * as CommonTypesUtils from "./commonTypesUtils";
export * as Inspection from "./inspection";
export * as InspectionUtils from "./inspectionUtils";
export * as PositionUtils from "./positionUtils";
export * as TraceUtils from "./traceUtils";
export * from "./analysis";
export * from "./commonTypes";
export * from "./diagnosticErrorCode";
export * from "./documentSymbols";
export * from "./externalType";
export * from "./formatter";
export * from "./inspectionSettings";
export * from "./jaroWinkler";
export * from "./library";
export * from "./providers";
export * from "./trace";
export * from "./validate";

export function createTextDocument(id: string, version: number, content: string): TextDocument {
    return TextDocument.create(id, "powerquery", version, content);
}

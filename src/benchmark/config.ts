// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Position } from "vscode-languageserver-types";

export type BenchmarkOperation =
    | {
          readonly kind: "getAutocompleteItems" | "getDefinition" | "getHover" | "getSignatureHelp";
          readonly position: Position;
      }
    | { readonly kind: "getRenameEdits"; readonly position: Position; readonly newName: string }
    | {
          readonly kind:
              | "getDocumentSymbols"
              | "getFoldingRanges"
              | "getPartialSemanticTokens"
              | "validate"
              | "validateUnknownIdentifiers";
      };

export interface BenchmarkFile {
    readonly path: string;
    readonly operations: ReadonlyArray<BenchmarkOperation>;
}

export interface BenchmarkConfig {
    readonly lexParse: boolean;
    readonly library: "standard" | "none";
    readonly files: ReadonlyArray<BenchmarkFile>;
}

export function parseConfig(value: unknown): BenchmarkConfig {
    const config: Record<string, unknown> = object(value, "payload");
    checkKeys(config, ["lexParse", "library", "files"], "payload");

    if (config.lexParse !== undefined && typeof config.lexParse !== "boolean") {
        throw new Error("lexParse must be a boolean");
    }

    const lexParse: boolean = config.lexParse ?? false;
    const library: unknown = config.library === undefined ? "standard" : config.library;

    if (library !== "standard" && library !== "none") {
        throw new Error('library must be "standard" or "none"');
    }

    if (!Array.isArray(config.files) || config.files.length === 0) {
        throw new Error("files must be a non-empty array");
    }

    const files: BenchmarkFile[] = config.files.map((entry: unknown, index: number) => {
        const label: string = `files[${index}]`;
        const file: Record<string, unknown> = object(entry, label);
        checkKeys(file, ["path", "operations"], label);

        if (typeof file.path !== "string" || file.path.trim().length === 0) {
            throw new Error(`${label}.path must be a non-empty string`);
        }

        const operations: unknown = file.operations === undefined ? [] : file.operations;

        if (!Array.isArray(operations) || (!lexParse && operations.length === 0)) {
            throw new Error(`${label}.operations must be an array; select at least one operation or lexParse`);
        }

        return {
            path: file.path,
            operations: operations.map((operation: unknown, operationIndex: number) =>
                parseOperation(operation, `${label}.operations[${operationIndex}]`),
            ),
        };
    });

    return { lexParse, library, files };
}

function parseOperation(value: unknown, label: string): BenchmarkOperation {
    const operation: Record<string, unknown> = object(value, label);
    const kind: unknown = operation.kind;

    switch (kind) {
        case "getAutocompleteItems":
        case "getDefinition":
        case "getHover":
        case "getSignatureHelp":
            checkKeys(operation, ["kind", "position"], label);

            return { kind, position: parsePosition(operation.position, `${label}.position`) };

        case "getRenameEdits":
            checkKeys(operation, ["kind", "position", "newName"], label);

            if (typeof operation.newName !== "string" || operation.newName.trim().length === 0) {
                throw new Error(`${label}.newName must be a non-empty string`);
            }

            return {
                kind,
                position: parsePosition(operation.position, `${label}.position`),
                newName: operation.newName,
            };

        case "getDocumentSymbols":
        case "getFoldingRanges":
        case "getPartialSemanticTokens":
        case "validate":
        case "validateUnknownIdentifiers":
            checkKeys(operation, ["kind"], label);

            return { kind };

        default:
            throw new Error(`${label}.kind is not a supported operation: ${String(kind)}`);
    }
}

function parsePosition(value: unknown, label: string): Position {
    const position: Record<string, unknown> = object(value, label);
    checkKeys(position, ["line", "character"], label);

    if (
        typeof position.line !== "number" ||
        !Number.isSafeInteger(position.line) ||
        position.line < 0 ||
        typeof position.character !== "number" ||
        !Number.isSafeInteger(position.character) ||
        position.character < 0
    ) {
        throw new Error(`${label} requires non-negative integer line and character`);
    }

    return { line: position.line, character: position.character };
}

function object(value: unknown, label: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }

    return value as Record<string, unknown>;
}

function checkKeys(value: Record<string, unknown>, allowed: ReadonlyArray<string>, label: string): void {
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) {
            throw new Error(`${label}: unknown property ${key}`);
        }
    }
}

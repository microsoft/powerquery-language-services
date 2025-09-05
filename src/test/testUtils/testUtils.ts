// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as File from "fs";
import * as Path from "path";
import { assert } from "chai";
import { Position } from "vscode-languageserver-types";

import { MockDocument } from "../mockDocument";

export function extractPosition(textWithPipe: string): [string, Position] {
    assert.isTrue((textWithPipe.match(/\|/g) ?? []).length == 1, `textWithPipe must contain exactly pipe character`);

    const lines: ReadonlyArray<string> = textWithPipe.split("\n");
    const numLines: number = lines.length;

    let position: Position | undefined;

    for (let lineIndex: number = 0; lineIndex < numLines; lineIndex += 1) {
        const line: string = lines[lineIndex];
        const indexOfPipe: number = line.indexOf("|");

        if (indexOfPipe !== -1) {
            position = {
                line: lineIndex,
                character: indexOfPipe,
            };

            break;
        }
    }

    if (position === undefined) {
        throw new Error(`couldn't find a pipe character in the input text`);
    }

    return [textWithPipe.replace(/\|/g, ""), position];
}

export function readFile(fileName: string): string {
    const fullPath: string = Path.join(Path.dirname(__filename), "..", "files", fileName);
    assert.isTrue(File.existsSync(fullPath), `file ${fullPath} not found.`);

    return File.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
}

export function mockDocument(text: string): MockDocument {
    return new MockDocument(text, "powerquery");
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as File from "fs";
import * as Path from "path";
import { assert, expect } from "chai";
import { Hover, MarkupContent, Position, SignatureHelp } from "vscode-languageserver-types";
import { Settings, Task, TaskUtils } from "@microsoft/powerquery-parser";

import { Inspection } from "../../powerquery-language-services";
import { MockDocument } from "../mockDocument";
import { TestUtils } from "..";

export function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);

    return value;
}

export function assertAutocompleteItemLabels(
    expected: ReadonlyArray<string>,
    actual: ReadonlyArray<Inspection.AutocompleteItem>,
): void {
    expected = [...expected].sort();
    const actualLabels: ReadonlyArray<string> = actual.map((item: Inspection.AutocompleteItem) => item.label).sort();
    expect(actualLabels).to.deep.equal(expected);
}

export function assertIsMarkupContent(value: Hover["contents"]): asserts value is MarkupContent {
    if (!MarkupContent.is(value)) {
        throw new Error(`expected value to be MarkupContent`);
    }
}

export function assertSignatureHelp(expected: TestUtils.AbridgedSignatureHelp, actual: SignatureHelp): void {
    expect(TestUtils.abridgedSignatureHelp(actual)).deep.equals(expected);
}

export function assertContainsAutocompleteItemLabels(
    expected: ReadonlyArray<string>,
    actual: ReadonlyArray<Inspection.AutocompleteItem>,
): void {
    const actualLabels: ReadonlyArray<string> = actual.map((item: Inspection.AutocompleteItem) => item.label);
    expect(actualLabels).to.include.members(expected);
}

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

export async function assertParse(
    settings: Settings,
    text: string,
): Promise<Task.ParseTaskOk | Task.ParseTaskParseError> {
    const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, text);

    if (TaskUtils.isParseStageOk(triedLexParseTask) || TaskUtils.isParseStageParseError(triedLexParseTask)) {
        return triedLexParseTask;
    } else {
        throw new Error(`unexpected task stage: ${triedLexParseTask.stage}`);
    }
}

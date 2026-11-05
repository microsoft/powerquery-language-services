// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Settings, Task, TaskUtils } from "@microsoft/powerquery-parser";
import { Position } from "vscode-languageserver-types";

import { ActiveNodeUtils, TActiveNode } from "../../powerquery-language-services/inspection";
import { TestUtils } from "..";

export async function assertActiveNode(params: {
    readonly textWithPipe: string;
    readonly settings: Settings;
}): Promise<TActiveNode> {
    const [text, position]: [string, Position] = TestUtils.extractPosition(params.textWithPipe);

    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await assertParse({
        text,
        settings: params.settings,
    });

    return ActiveNodeUtils.activeNode(triedParse.nodeIdMapCollection, position);
}

export async function assertParse(params: {
    readonly text: string;
    readonly settings: Settings;
}): Promise<Task.ParseTaskOk | Task.ParseTaskParseError> {
    const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(params.settings, params.text);

    if (TaskUtils.isParseStageOk(triedLexParseTask) || TaskUtils.isParseStageParseError(triedLexParseTask)) {
        return triedLexParseTask;
    } else {
        throw new Error(`unexpected task stage: ${triedLexParseTask.stage}`);
    }
}

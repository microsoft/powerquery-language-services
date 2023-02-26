// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ICancellationToken, Settings } from "@microsoft/powerquery-parser";
import { FoldingRange, Hover, SignatureHelp } from "vscode-languageserver-types";
import { expect } from "chai";
import { TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";

import { abridgedNodeScopeItems, TAbridgedNodeScopeItem } from "./abridgedUtils";
import {
    AnalysisSettings,
    Inspection,
    InspectionSettings,
    PartialSemanticToken,
} from "../../powerquery-language-services";
import { NodeScope } from "../../powerquery-language-services/inspection";
import { TestUtils } from "..";

export async function assertEqualAutocomplete(
    expected: ReadonlyArray<string>,
    settings: AnalysisSettings,
    textWithPipe: string,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: ReadonlyArray<Inspection.AutocompleteItem> | undefined = await TestUtils.assertAutocompleteAnalysis(
        settings,
        textWithPipe,
        cancellationToken,
    );

    if (expected) {
        Assert.isDefined(actual);
        TestUtils.assertContainsAutocompleteItemLabels(expected, actual);
    } else {
        Assert.isUndefined(actual);
    }
}

export async function assertEqualFoldingRangesAnalysis(
    expected: ReadonlyArray<FoldingRange>,
    settings: AnalysisSettings,
    text: string,
): Promise<void> {
    const foldingRanges: FoldingRange[] | undefined = await TestUtils.assertFoldingRangesAnalysis(settings, text);

    if (expected) {
        Assert.isDefined(foldingRanges);
        expect(foldingRanges).to.deep.equal(expected);
    } else {
        Assert.isUndefined(foldingRanges);
    }
}

export async function assertEqualHoverAnalysis(
    expected: string | undefined,
    settings: AnalysisSettings,
    textWithPipe: string,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: Hover | undefined = await TestUtils.assertHoverAnalysis(settings, textWithPipe, cancellationToken);

    if (expected) {
        Assert.isDefined(actual);
        expect(actual.contents).to.equal(expected);
    } else {
        Assert.isUndefined(actual);
    }
}

export async function assertEqualNodeScope(
    expected: ReadonlyArray<TAbridgedNodeScopeItem>,
    settings: Settings,
    textWithPipe: string,
): Promise<void> {
    const nodeScope: NodeScope = await TestUtils.assertNodeScope(settings, textWithPipe);
    const actual: ReadonlyArray<TAbridgedNodeScopeItem> = abridgedNodeScopeItems(nodeScope);
    expect(actual).deep.equal(expected);
}

export async function assertEqualPartialSemanticTokensAnalysis(
    expected: ReadonlyArray<PartialSemanticToken> | undefined,
    settings: AnalysisSettings,
    text: string,
): Promise<void> {
    const semanticTokens: PartialSemanticToken[] | undefined = await TestUtils.assertPartialSemanticTokens(
        settings,
        text,
    );

    if (expected) {
        Assert.isDefined(semanticTokens);
        expect(semanticTokens).to.deep.equal(expected);
    } else {
        Assert.isUndefined(semanticTokens);
    }
}

export async function assertEqualRootType(
    expected: TPowerQueryType,
    settings: InspectionSettings,
    text: string,
): Promise<void> {
    const actual: TPowerQueryType = await TestUtils.assertRootType(settings, text);
    expect(actual).to.deep.equal(expected);
}

export async function assertEqualSignatureHelpAnalysis(
    expected: ReadonlyArray<SignatureHelp | undefined>,
    settings: AnalysisSettings,
    text: string,
): Promise<void> {
    const signatureHelp: SignatureHelp | undefined = await TestUtils.assertSignatureHelpAnalysis(settings, text);

    if (expected) {
        Assert.isDefined(signatureHelp);
        expect(signatureHelp).to.deep.equal(expected);
    } else {
        Assert.isUndefined(signatureHelp);
    }
}

export async function assertEqualScopeType(
    expected: Inspection.ScopeTypeByKey,
    settings: InspectionSettings,
    textWithPipe: string,
): Promise<void> {
    const actual: Inspection.ScopeTypeByKey = await TestUtils.assertScopeType(settings, textWithPipe);
    expect(actual).to.deep.equal(expected);
}

// export async function assertNodeIdMap(settings: Settings, text: string): Promise<NodeIdMap.Collection> {
//     const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, text);

//     if (TaskUtils.isParseStageOk(triedLexParseTask)) {
//         return triedLexParseTask.nodeIdMapCollection;
//     } else if (TaskUtils.isParseStageParseError(triedLexParseTask)) {
//         return triedLexParseTask.nodeIdMapCollection;
//     } else {
//         throw new Error(`unexpected task stage: ${triedLexParseTask.stage}`);
//     }
// }

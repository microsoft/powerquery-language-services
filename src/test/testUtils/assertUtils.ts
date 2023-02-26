// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    Assert,
    CommonError,
    DefaultSettings,
    ICancellationToken,
    Result,
    Settings,
    Task,
    TaskUtils,
    Parser,
    ResultUtils,
} from "@microsoft/powerquery-parser";
import { Diagnostic, Hover, Location, MarkupContent, Position, SignatureHelp } from "vscode-languageserver-types";
import { expect } from "chai";
import { Range } from "vscode-languageserver-textdocument";

import * as TestConstants from "../testConstants";
import * as TestUtils from "./testUtils";
import {
    ActiveNodeUtils,
    autocomplete,
    Inspected,
    InspectionInstance,
    NodeScope,
    TActiveNode,
    TriedCurrentInvokeExpression,
    TriedNodeScope,
    TriedScopeType,
    tryCurrentInvokeExpression,
    tryNodeScope,
    tryScopeType,
    Type,
    TypeCache,
    TypeCacheUtils,
} from "../../powerquery-language-services/inspection";
import {
    Analysis,
    AnalysisSettings,
    AnalysisUtils,
    Inspection,
    InspectionSettings,
    TextDocument,
    validate,
    ValidationSettings,
} from "../../powerquery-language-services";
import { TriedExpectedType, tryExpectedType } from "../../powerquery-language-services/inspection/expectedType";
import { ValidateOk } from "../../powerquery-language-services/validate/validateOk";
import { abridgedNodeScopeItems, TAbridgedNodeScopeItem } from "./abridgedUtils";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";
import { MockDocument } from "../mockDocument";

export function assertAnalysisAndPositionFromText(
    analysisSettings: AnalysisSettings,
    textWithPipe: string,
): [Analysis, Position] {
    const [document, position]: [MockDocument, Position] = createMockDocumentAndPosition(textWithPipe);
    const analysis: Analysis = AnalysisUtils.createAnalysis(document, analysisSettings);

    return [analysis, position];
}

export async function assertAutocomplete(
    settings: InspectionSettings,
    textWithPipe: string,
): Promise<Inspection.Autocomplete> {
    return (await assertInspected(settings, textWithPipe)).autocomplete;
    // const [text, position]: [string, Position] = assertExtractPosition(textWithPipe);
    // const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await assertParse(settings, text);

    // return Inspection.autocomplete(
    //     settings,
    //     triedParse.parseState,
    //     TypeCacheUtils.createEmptyCache(),
    //     ActiveNodeUtils.activeNode(triedParse.nodeIdMapCollection, position),
    //     TaskUtils.isParseStageParseError(triedParse) ? triedParse.error : undefined,
    // );
}

export async function assertEqualHover(
    expected: string | undefined,
    settings: AnalysisSettings,
    textWithPipe: string,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: Hover | undefined = await assertHoverAnalysis(settings, textWithPipe, cancellationToken);

    if (expected) {
        Assert.isDefined(actual);
        expect(actual.contents).to.equal(expected);
    } else {
        Assert.isUndefined(actual);
    }
}

export function assertContainsAutocompleteItemLabels(
    expected: ReadonlyArray<string>,
    actual: ReadonlyArray<Inspection.AutocompleteItem>,
): void {
    const actualLabels: ReadonlyArray<string> = actual.map((item: Inspection.AutocompleteItem) => item.label);
    expect(actualLabels).to.include.members(expected);
}

export async function assertEqualNodeScope(
    settings: Settings,
    textWithPipe: string,
    expected: ReadonlyArray<TAbridgedNodeScopeItem>,
): Promise<void> {
    const nodeScope: NodeScope = await assertNodeScope(settings, textWithPipe);
    const actual: ReadonlyArray<TAbridgedNodeScopeItem> = abridgedNodeScopeItems(nodeScope);
    expect(actual).deep.equal(expected);
}

export async function assertEqualScopeType(
    settings: InspectionSettings,
    textWithPipe: string,
    expected: Inspection.ScopeTypeByKey,
): Promise<void> {
    const actual: Inspection.ScopeTypeByKey = await assertScopeType(settings, textWithPipe);
    expect(actual).to.deep.equal(expected);
}

export async function assertEqualRootType(
    settings: InspectionSettings,
    text: string,
    expected: TPowerQueryType,
): Promise<void> {
    const actual: TPowerQueryType = await assertRootType(settings, text);
    expect(actual).to.deep.equal(expected);
}

export function assertExtractPosition(textWithPipe: string): [string, Position] {
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

    return [textWithPipe.replace("|", ""), position];
}

export async function assertHoverAnalysis(
    settings: AnalysisSettings,
    textWithPipe: string,
    cancellationToken?: ICancellationToken,
): Promise<Hover | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(settings, textWithPipe);

    return Assert.unboxOk(await analysis.getHover(position, cancellationToken));
}

export async function assertInspected(
    settings: InspectionSettings,
    textWithPipe: string,
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Promise<Inspected> {
    const [text, position]: [string, Position] = assertExtractPosition(textWithPipe);

    return await Assert.unboxOk(await Inspection.tryInspect(settings, text, position, typeCache));
}

export async function assertRootType(settings: InspectionSettings, text: string): Promise<TPowerQueryType> {
    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await assertParse(settings, text);

    const root: TXorNode = TaskUtils.isParseStageOk(triedParse)
        ? XorNodeUtils.boxAst(triedParse.ast)
        : XorNodeUtils.boxContext(Assert.asDefined(triedParse.parseState.contextState.root));

    const actual: Inspection.TriedType = await Inspection.tryType(
        settings,
        triedParse.nodeIdMapCollection,
        root.node.id,
    );

    Assert.isOk(actual);

    return actual.value;
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

export async function assertNodeScope(settings: Settings, textWithPipe: string): Promise<NodeScope> {
    const [text, position]: [string, Position] = assertExtractPosition(textWithPipe);
    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await assertParse(settings, text);
    const nodeIdMapCollection: NodeIdMap.Collection = triedParse.nodeIdMapCollection;
    const activeNode: TActiveNode = ActiveNodeUtils.activeNode(nodeIdMapCollection, position);

    if (!ActiveNodeUtils.isPositionInBounds(activeNode)) {
        return new Map();
    }

    return Assert.unboxOk(
        await tryNodeScope(
            settings,
            nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            TypeCacheUtils.createEmptyCache().scopeById,
        ),
    );
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

export async function assertScopeType(
    settings: InspectionSettings,
    textWithPipe: string,
): Promise<Inspection.ScopeTypeByKey> {
    const [text, position]: [string, Position] = assertExtractPosition(textWithPipe);
    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await assertParse(settings, text);
    const nodeIdMapCollection: NodeIdMap.Collection = triedParse.nodeIdMapCollection;

    const activeNodeLeaf: TXorNode = Inspection.ActiveNodeUtils.assertGetLeaf(
        ActiveNodeUtils.assertActiveNode(nodeIdMapCollection, position),
    );

    const triedScopeType: Inspection.TriedScopeType = await Inspection.tryScopeType(
        settings,
        nodeIdMapCollection,
        activeNodeLeaf.node.id,
    );

    Assert.isOk(triedScopeType);

    return triedScopeType.value;
}

function createMockDocumentAndPosition(textWithPipe: string): [MockDocument, Position] {
    const [text, position]: [string, Position] = assertExtractPosition(textWithPipe);
    const document: MockDocument = TestUtils.mockDocument(text);

    return [document, position];
}

// export function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
//     assertIsMarkupContent(value);

//     return value;
// }

// export async function assertContainsAutocompleteItemsFromAnalysis(
//     textWithPipe: string,
//     expected: ReadonlyArray<string>,
//     analysisSettings?: AnalysisSettings,
//     cancellationToken: ICancellationToken = TestConstants.NoOpCancellationTokenInstance,
// ): Promise<void> {
//     const result: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
//         await TestUtils.createAutocompleteItemsFromAnalysis(textWithPipe, analysisSettings, cancellationToken);

//     Assert.isOk(result);
//     Assert.isDefined(result.value);
//     expect(result.value).to.deep.equal(expected);
// }

// export function assertContainsAutocompleteItem(
//     label: string,
//     autocompleteItems: ReadonlyArray<Inspection.AutocompleteItem>,
// ): Inspection.AutocompleteItem {
//     return Assert.asDefined(
//         autocompleteItems.find((completionitem: Inspection.AutocompleteItem) => completionitem.label === "Test.Foo"),
//         `did not find the expected completion item`,
//         {
//             label,
//             completionItemLabels: autocompleteItems.map(
//                 (completionItem: Inspection.AutocompleteItem) => completionItem.label,
//             ),
//         },
//     );
// }

// export async function assertGetLexParseOk(settings: PQP.Settings, text: string): Promise<PQP.Task.ParseTaskOk> {
//     const triedLexParseTask: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(settings, text);
//     TaskUtils.assertIsParseStageOk(triedLexParseTask);

//     return triedLexParseTask;
// }

// export async function assertGetLexParseError(
//     settings: PQP.Settings,
//     text: string,
// ): Promise<PQP.Task.ParseTaskParseError> {
//     const triedLexParseTask: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(settings, text);
//     TaskUtils.assertIsParseStageParseError(triedLexParseTask);

//     return triedLexParseTask;
// }

// export async function assertNodeScope(settings: PQP.Settings, text: string, position: Position): Promise<NodeScope> {
//     const triedLexParseTask: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(settings, text);
//     let nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection;

//     if (TaskUtils.isParseStageOk(triedLexParseTask)) {
//         nodeIdMapCollection = triedLexParseTask.nodeIdMapCollection;
//     } else if (TaskUtils.isParseStageParseError(triedLexParseTask)) {
//         nodeIdMapCollection = triedLexParseTask.nodeIdMapCollection;
//     } else {
//         throw new Error(`unexpected task stage: ${triedLexParseTask.stage}`);
//     }

//     const activeNode: TActiveNode = ActiveNodeUtils.activeNode(nodeIdMapCollection, position);

//     if (!ActiveNodeUtils.isPositionInBounds(activeNode)) {
//         return new Map();
//     }

//     return Assert.unboxOk(
//         await tryNodeScope(
//             settings,
//             nodeIdMapCollection,
//             ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
//             TypeCacheUtils.createEmptyCache().scopeById,
//         ),
//     );
// }

// export function assertExtractPosition(textWithPipe: string): [string, Position] {
//     const lines: ReadonlyArray<string> = textWithPipe.split("\n");
//     const numLines: number = lines.length;

//     let position: Position | undefined;

//     for (let lineIndex: number = 0; lineIndex < numLines; lineIndex += 1) {
//         const line: string = lines[lineIndex];
//         const indexOfPipe: number = line.indexOf("|");

//         if (indexOfPipe !== -1) {
//             position = {
//                 line: lineIndex,
//                 character: indexOfPipe,
//             };

//             break;
//         }
//     }

//     if (position === undefined) {
//         throw new Error(`couldn't find a pipe character in the input text`);
//     }

//     return [textWithPipe.replace("|", ""), position];
// }

export async function assertValidate(
    analysisSettings: AnalysisSettings,
    validationSettings: ValidationSettings,
    text: string,
): Promise<ValidateOk> {
    const mockDocument: MockDocument = TestUtils.mockDocument(text);

    const triedValidation: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
        mockDocument,
        analysisSettings,
        validationSettings,
    );

    Assert.isOk(triedValidation);
    Assert.isDefined(triedValidation.value);

    return triedValidation.value;
}

export async function assertValidateDiagnostics(
    analysisSettings: AnalysisSettings,
    validationSettings: ValidationSettings,
    text: string,
): Promise<Diagnostic[]> {
    return (await assertValidate(analysisSettings, validationSettings, text)).diagnostics;
}

// export function assertEqualHover(expected: string, actual: Hover): void {
//     const contents: string = assertAsMarkupContent(actual.contents).value;
//     expect(contents).to.equal(expected);
// }

// export function assertEqualLocation(expected: ReadonlyArray<Range>, actual: ReadonlyArray<Location>): void {
//     const actualRange: ReadonlyArray<Range> = actual.map((location: Location) => location.range);
//     expect(actualRange).deep.equals(expected);
// }

// export function assertIsDefined<T>(
//     value: T | undefined,
//     message?: string,
//     details?: object,
// ): asserts value is NonNullable<T> {
//     Assert.isDefined(value, message, details);
// }

// export function assertIsMarkupContent(value: Hover["contents"]): asserts value is MarkupContent {
//     if (!MarkupContent.is(value)) {
//         throw new Error(`expected value to be MarkupContent`);
//     }
// }

// export function assertSignatureHelp(expected: TestUtils.AbridgedSignatureHelp, actual: SignatureHelp): void {
//     expect(TestUtils.createAbridgedSignatureHelp(actual)).deep.equals(expected);
// }

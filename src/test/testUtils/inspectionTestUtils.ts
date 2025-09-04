// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    Assert,
    CommonError,
    NoOpCancellationToken,
    Result,
    ResultUtils,
    Settings,
    Task,
    TaskUtils,
} from "@microsoft/powerquery-parser";
import { Diagnostic, DocumentSymbol, Position } from "vscode-languageserver-types";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";

import {
    ActiveNode,
    ActiveNodeUtils,
    Inspected,
    NodeScope,
    TActiveNode,
    tryNodeScope,
    TypeCache,
    TypeCacheUtils,
} from "../../powerquery-language-services/inspection";
import {
    AnalysisSettings,
    getDocumentSymbols,
    Inspection,
    InspectionSettings,
    validate,
    ValidationSettings,
} from "../../powerquery-language-services";
import { MockDocument } from "../mockDocument";
import { TestUtils } from "..";
import { ValidateOk } from "../../powerquery-language-services/validate/validateOk";

export async function assertActiveNode(params: {
    readonly textWithPipe: string;
    readonly settings: Settings;
}): Promise<TActiveNode> {
    const [text, position]: [string, Position] = TestUtils.extractPosition(params.textWithPipe);

    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse({
        text,
        settings: params.settings,
    });

    return ActiveNodeUtils.activeNode(triedParse.nodeIdMapCollection, position);
}

export async function assertAutocompleteInspection(params: {
    readonly textWithPipe: string;
    readonly inspectionSettings: InspectionSettings;
}): Promise<Inspection.Autocomplete> {
    return (await assertInspected(params)).autocomplete;
}

export async function assertDocumentSymbolsInspection(params: {
    readonly text: string;
    readonly inspectionSettings: Settings;
}): Promise<ReadonlyArray<DocumentSymbol>> {
    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse({
        text: params.text,
        settings: params.inspectionSettings,
    });

    return getDocumentSymbols(triedParse.nodeIdMapCollection, NoOpCancellationToken);
}

export async function assertInBoundsActiveNode(params: {
    readonly settings: Settings;
    readonly textWithPipe: string;
}): Promise<ActiveNode> {
    const activeNode: TActiveNode = await assertActiveNode(params);
    ActiveNodeUtils.assertPositionInBounds(activeNode);

    return activeNode;
}

export async function assertInspected(params: {
    readonly textWithPipe: string;
    readonly inspectionSettings: InspectionSettings;
    readonly typeCache?: TypeCache;
}): Promise<Inspected> {
    const [text, position]: [string, Position] = TestUtils.extractPosition(params.textWithPipe);

    return await ResultUtils.assertOk(
        await Inspection.tryInspect(
            params.inspectionSettings,
            text,
            position,
            params.typeCache ?? TypeCacheUtils.emptyCache(),
        ),
    );
}

export async function assertRootType(params: {
    readonly text: string;
    readonly inspectionSettings: InspectionSettings;
}): Promise<TPowerQueryType> {
    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse({
        text: params.text,
        settings: params.inspectionSettings,
    });

    const root: TXorNode = TaskUtils.isParseStageOk(triedParse)
        ? XorNodeUtils.boxAst(triedParse.ast)
        : XorNodeUtils.boxContext(Assert.asDefined(triedParse.parseState.contextState.root));

    const actual: Inspection.TriedType = await Inspection.tryType(
        params.inspectionSettings,
        triedParse.nodeIdMapCollection,
        root.node.id,
    );

    ResultUtils.assertIsOk(actual);

    return actual.value;
}

export async function assertNodeScope(params: {
    readonly textWithPipe: string;
    readonly inspectionSettings: InspectionSettings;
}): Promise<NodeScope> {
    const [text, position]: [string, Position] = TestUtils.extractPosition(params.textWithPipe);

    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse({
        text,
        settings: params.inspectionSettings,
    });

    const nodeIdMapCollection: NodeIdMap.Collection = triedParse.nodeIdMapCollection;
    const activeNode: TActiveNode = ActiveNodeUtils.activeNode(nodeIdMapCollection, position);

    if (!ActiveNodeUtils.isPositionInBounds(activeNode)) {
        return new Map();
    }

    return ResultUtils.assertOk(
        await tryNodeScope(
            params.inspectionSettings,
            nodeIdMapCollection,
            params.inspectionSettings.eachScopeById,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            TypeCacheUtils.emptyCache().scopeById,
        ),
    );
}

export async function assertScopeType(params: {
    readonly textWithPipe: string;
    readonly inspectionSettings: InspectionSettings;
}): Promise<Inspection.ScopeTypeByKey> {
    const [text, position]: [string, Position] = TestUtils.extractPosition(params.textWithPipe);

    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse({
        text,
        settings: params.inspectionSettings,
    });

    const nodeIdMapCollection: NodeIdMap.Collection = triedParse.nodeIdMapCollection;

    const activeNodeLeaf: TXorNode = Inspection.ActiveNodeUtils.assertGetLeaf(
        ActiveNodeUtils.assertActiveNode(nodeIdMapCollection, position),
    );

    const triedScopeType: Inspection.TriedScopeType = await Inspection.tryScopeType(
        params.inspectionSettings,
        nodeIdMapCollection,
        activeNodeLeaf.node.id,
    );

    ResultUtils.assertIsOk(triedScopeType);

    return triedScopeType.value;
}

export async function assertValidate(params: {
    readonly text: string;
    readonly analysisSettings: AnalysisSettings;
    readonly validationSettings: ValidationSettings;
}): Promise<ValidateOk> {
    const mockDocument: MockDocument = TestUtils.mockDocument(params.text);

    const triedValidation: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
        mockDocument,
        params.analysisSettings,
        params.validationSettings,
    );

    ResultUtils.assertIsOk(triedValidation);
    Assert.isDefined(triedValidation.value);

    return triedValidation.value;
}

export async function assertValidateDiagnostics(params: {
    readonly text: string;
    readonly analysisSettings: AnalysisSettings;
    readonly validationSettings: ValidationSettings;
}): Promise<Diagnostic[]> {
    return (await assertValidate(params)).diagnostics;
}

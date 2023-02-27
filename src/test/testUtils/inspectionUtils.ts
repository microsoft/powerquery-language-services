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

export async function assertAutocompleteInspection(
    settings: InspectionSettings,
    textWithPipe: string,
): Promise<Inspection.Autocomplete> {
    return (await assertInspected(settings, textWithPipe)).autocomplete;
}

export async function assertDocumentSymbolsInspection(
    settings: Settings,
    text: string,
): Promise<ReadonlyArray<DocumentSymbol>> {
    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse(settings, text);

    return getDocumentSymbols(triedParse.nodeIdMapCollection, NoOpCancellationToken);
}

export async function assertInspected(
    settings: InspectionSettings,
    textWithPipe: string,
    typeCache: TypeCache = TypeCacheUtils.emptyCache(),
): Promise<Inspected> {
    const [text, position]: [string, Position] = TestUtils.extractPosition(textWithPipe);

    return await ResultUtils.assertUnboxOk(await Inspection.tryInspect(settings, text, position, typeCache));
}

export async function assertRootType(settings: InspectionSettings, text: string): Promise<TPowerQueryType> {
    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse(settings, text);

    const root: TXorNode = TaskUtils.isParseStageOk(triedParse)
        ? XorNodeUtils.boxAst(triedParse.ast)
        : XorNodeUtils.boxContext(Assert.asDefined(triedParse.parseState.contextState.root));

    const actual: Inspection.TriedType = await Inspection.tryType(
        settings,
        triedParse.nodeIdMapCollection,
        root.node.id,
    );

    ResultUtils.assertIsOk(actual);

    return actual.value;
}

export async function assertNodeScope(settings: Settings, textWithPipe: string): Promise<NodeScope> {
    const [text, position]: [string, Position] = TestUtils.extractPosition(textWithPipe);
    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse(settings, text);
    const nodeIdMapCollection: NodeIdMap.Collection = triedParse.nodeIdMapCollection;
    const activeNode: TActiveNode = ActiveNodeUtils.activeNode(nodeIdMapCollection, position);

    if (!ActiveNodeUtils.isPositionInBounds(activeNode)) {
        return new Map();
    }

    return ResultUtils.assertUnboxOk(
        await tryNodeScope(
            settings,
            nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            TypeCacheUtils.emptyCache().scopeById,
        ),
    );
}

export async function assertScopeType(
    settings: InspectionSettings,
    textWithPipe: string,
): Promise<Inspection.ScopeTypeByKey> {
    const [text, position]: [string, Position] = TestUtils.extractPosition(textWithPipe);
    const triedParse: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse(settings, text);
    const nodeIdMapCollection: NodeIdMap.Collection = triedParse.nodeIdMapCollection;

    const activeNodeLeaf: TXorNode = Inspection.ActiveNodeUtils.assertGetLeaf(
        ActiveNodeUtils.assertActiveNode(nodeIdMapCollection, position),
    );

    const triedScopeType: Inspection.TriedScopeType = await Inspection.tryScopeType(
        settings,
        nodeIdMapCollection,
        activeNodeLeaf.node.id,
    );

    ResultUtils.assertIsOk(triedScopeType);

    return triedScopeType.value;
}

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

    ResultUtils.assertIsOk(triedValidation);
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

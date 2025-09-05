// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ResultUtils, Task, TaskUtils } from "@microsoft/powerquery-parser";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Position } from "vscode-languageserver-types";
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
import { Inspection, InspectionSettings } from "../../powerquery-language-services";
import { TestUtils } from "..";

export async function assertAutocompleteInspection(params: {
    readonly textWithPipe: string;
    readonly inspectionSettings: InspectionSettings;
}): Promise<Inspection.Autocomplete> {
    return (await assertInspected(params)).autocomplete;
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

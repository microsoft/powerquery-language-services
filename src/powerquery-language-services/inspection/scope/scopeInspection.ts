// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { Inspection, LanguageServiceTraceConstant, TraceUtils } from "../..";
import {
    LetVariableScopeItem,
    NodeScope,
    ParameterScopeItem,
    RecordFieldScopeItem,
    ScopeById,
    ScopeItemKind,
    SectionMemberScopeItem,
    TriedNodeScope,
    TScopeItem,
} from "./scope";
import {
    PseduoFunctionExpressionType,
    pseudoFunctionExpressionType,
    PseudoFunctionParameterType,
} from "../pseudoFunctionExpressionType";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

// Builds a scope for the given node.
export function tryNodeScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    // scopeById may get mutated by adding new entries.
    scopeById: ScopeById,
): TriedNodeScope {
    const trace: Trace = settings.traceManager.entry(LanguageServiceTraceConstant.Scope, tryNodeScope.name);

    const result: TriedNodeScope = ResultUtils.ensureResult(settings.locale, () => {
        const ancestry: ReadonlyArray<TXorNode> = AncestryUtils.assertGetAncestry(nodeIdMapCollection, nodeId);
        if (ancestry.length === 0) {
            return new Map();
        }

        const inspected: ScopeById = inspectScope(settings, nodeIdMapCollection, ancestry, scopeById);
        return Assert.asDefined(inspected.get(nodeId), `expected nodeId in scope result`, { nodeId });
    });
    trace.exit();

    return result;
}

export function assertGetOrCreateNodeScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    // scopeById may get mutated by adding new entries.
    scopeById: ScopeById,
): Inspection.TriedNodeScope {
    const trace: Trace = settings.traceManager.entry(
        LanguageServiceTraceConstant.Scope,
        assertGetOrCreateNodeScope.name,
    );

    const maybeScope: NodeScope | undefined = scopeById.get(nodeId);
    if (maybeScope !== undefined) {
        trace.exit({ [TraceConstant.IsThrowing]: false });

        return ResultUtils.boxOk(maybeScope);
    }

    const triedNodeScope: TriedNodeScope = tryNodeScope(settings, nodeIdMapCollection, nodeId, scopeById);
    if (ResultUtils.isError(triedNodeScope)) {
        trace.exit({ [TraceConstant.IsThrowing]: true });

        throw triedNodeScope;
    }

    trace.exit({ [TraceConstant.IsThrowing]: false });

    return triedNodeScope;
}

// Recusrive deference of the identifier until it reaches the value node.
// Does not handle recursive identifiers.
export function maybeDereferencedIdentifier(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    // If a map is given, then it's mutated and returned.
    // Else create a new Map instance and return that instead.
    scopeById: ScopeById = new Map(),
): PQP.Result<TXorNode | undefined, PQP.CommonError.CommonError> {
    const trace: Trace = settings.traceManager.entry(
        LanguageServiceTraceConstant.Scope,
        maybeDereferencedIdentifier.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );
    XorNodeUtils.assertIsIdentifier(xorNode);

    if (XorNodeUtils.isContextXor(xorNode)) {
        trace.exit({ [TraceConstant.Result]: undefined });

        return ResultUtils.boxOk(undefined);
    }
    const identifier: Ast.Identifier | Ast.IdentifierExpression = xorNode.node as
        | Ast.Identifier
        | Ast.IdentifierExpression;

    let identifierLiteral: string;
    let isIdentifierRecurisve: boolean;

    switch (identifier.kind) {
        case Ast.NodeKind.Identifier:
            identifierLiteral = identifier.literal;
            isIdentifierRecurisve = false;
            break;

        case Ast.NodeKind.IdentifierExpression:
            identifierLiteral = identifier.identifier.literal;
            isIdentifierRecurisve = identifier.maybeInclusiveConstant !== undefined;
            break;

        default:
            throw Assert.isNever(identifier);
    }

    const triedNodeScope: Inspection.TriedNodeScope = assertGetOrCreateNodeScope(
        settings,
        nodeIdMapCollection,
        xorNode.node.id,
        scopeById,
    );
    if (ResultUtils.isError(triedNodeScope)) {
        trace.exit({ [TraceConstant.Result]: triedNodeScope.kind });

        return triedNodeScope;
    }

    const nodeScope: NodeScope = triedNodeScope.value;
    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(identifierLiteral);
    if (
        // If the identifier couldn't be found in the generated scope,
        // then either the scope generation is incorrect or it's an external identifier.
        maybeScopeItem?.isRecursive !== isIdentifierRecurisve
    ) {
        trace.exit({ [TraceConstant.Result]: undefined });

        return ResultUtils.boxOk(undefined);
    }
    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: TXorNode | undefined;
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
        case ScopeItemKind.Parameter:
        case ScopeItemKind.Undefined:
            break;

        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        default:
            throw Assert.isNever(scopeItem);
    }

    let result: PQP.Result<TXorNode | undefined, PQP.CommonError.CommonError>;
    if (maybeNextXorNode === undefined) {
        result = ResultUtils.boxOk(xorNode);
    } else if (
        XorNodeUtils.isContextXor(maybeNextXorNode) ||
        (maybeNextXorNode.node.kind !== Ast.NodeKind.Identifier &&
            maybeNextXorNode.node.kind !== Ast.NodeKind.IdentifierExpression)
    ) {
        result = ResultUtils.boxOk(xorNode);
    } else {
        result = maybeDereferencedIdentifier(settings, nodeIdMapCollection, maybeNextXorNode, scopeById);
    }
    trace.exit({ [TraceConstant.Result]: result.kind });

    return result;
}

interface ScopeInspectionState extends Pick<PQP.CommonSettings, "traceManager"> {
    readonly givenScope: ScopeById;
    readonly deltaScope: ScopeById;
    readonly ancestry: ReadonlyArray<TXorNode>;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    ancestryIndex: number;
}

function inspectScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    ancestry: ReadonlyArray<TXorNode>,
    // scopeById may get mutated by adding new entries.
    scopeById: ScopeById,
): ScopeById {
    const trace: Trace = settings.traceManager.entry(LanguageServiceTraceConstant.Scope, inspectScope.name);
    const rootId: number = ancestry[0].node.id;

    // A scope for the given ancestry has already been generated.
    const maybeCached: NodeScope | undefined = scopeById.get(rootId);
    if (maybeCached !== undefined) {
        trace.exit();

        return scopeById;
    }

    // Store the delta between the given scope and what's found in a temporary map.
    // This will prevent mutation in the given map if an error is thrown.
    const scopeChanges: ScopeById = new Map();
    const state: ScopeInspectionState = {
        traceManager: settings.traceManager,
        givenScope: scopeById,
        deltaScope: scopeChanges,
        ancestry,
        nodeIdMapCollection,
        ancestryIndex: 0,
    };

    // Build up the scope through a top-down inspection.
    const numNodes: number = ancestry.length;
    for (let ancestryIndex: number = numNodes - 1; ancestryIndex >= 0; ancestryIndex -= 1) {
        state.ancestryIndex = ancestryIndex;
        const xorNode: TXorNode = ancestry[ancestryIndex];

        inspectNode(state, xorNode);
    }
    trace.exit();

    return state.deltaScope;
}

function inspectNode(state: ScopeInspectionState, xorNode: TXorNode): void {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Scope,
        inspectNode.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    switch (xorNode.node.kind) {
        case Ast.NodeKind.EachExpression:
            inspectEachExpression(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            inspectFunctionExpression(state, xorNode);
            break;

        case Ast.NodeKind.LetExpression:
            inspectLetExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            inspectRecordExpressionOrRecordLiteral(state, xorNode);
            break;

        case Ast.NodeKind.Section:
            inspectSection(state, xorNode);
            break;

        default:
            localGetOrCreateNodeScope(state, xorNode.node.id, undefined);
    }

    trace.exit();
}

function inspectEachExpression(state: ScopeInspectionState, eachExpr: TXorNode): void {
    XorNodeUtils.assertIsNodeKind<Ast.EachExpression>(eachExpr, Ast.NodeKind.EachExpression);
    expandChildScope(
        state,
        eachExpr,
        [1],
        [
            [
                "_",
                {
                    kind: ScopeItemKind.Each,
                    id: eachExpr.node.id,
                    isRecursive: false,
                    eachExpression: eachExpr,
                },
            ],
        ],
        undefined,
    );
}

function inspectFunctionExpression(state: ScopeInspectionState, fnExpr: TXorNode): void {
    XorNodeUtils.assertIsNodeKind<Ast.FunctionExpression>(fnExpr, Ast.NodeKind.FunctionExpression);

    // Propegates the parent's scope.
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, fnExpr.node.id, undefined);
    const pseudoType: PseduoFunctionExpressionType = pseudoFunctionExpressionType(state.nodeIdMapCollection, fnExpr);

    const newEntries: ReadonlyArray<[string, ParameterScopeItem]> = pseudoType.parameters.map(
        (parameter: PseudoFunctionParameterType) => {
            return [
                parameter.name.literal,
                {
                    kind: ScopeItemKind.Parameter,
                    id: parameter.id,
                    isRecursive: false,
                    name: parameter.name,
                    isOptional: parameter.isOptional,
                    isNullable: parameter.isNullable,
                    maybeType:
                        parameter.maybeType !== undefined
                            ? TypeUtils.maybePrimitiveTypeConstantKindFromTypeKind(parameter.maybeType)
                            : undefined,
                },
            ];
        },
    );
    expandChildScope(state, fnExpr, [3], newEntries, nodeScope);
}

function inspectLetExpression(state: ScopeInspectionState, letExpr: TXorNode): void {
    XorNodeUtils.assertIsNodeKind<Ast.LetExpression>(letExpr, Ast.NodeKind.LetExpression);

    // Propegates the parent's scope.
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, letExpr.node.id, undefined);

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.LetKeyValuePair> = NodeIdMapIterator.iterLetExpression(
        state.nodeIdMapCollection,
        letExpr,
    );

    inspectKeyValuePairs(state, nodeScope, keyValuePairs, createLetVariableScopeItem);

    // Places the assignments from the 'let' into LetExpression.expression
    const newEntries: ReadonlyArray<[string, LetVariableScopeItem]> = scopeItemsFromKeyValuePairs(
        keyValuePairs,
        -1,
        createLetVariableScopeItem,
    );
    expandChildScope(state, letExpr, [3], newEntries, nodeScope);
}

function inspectRecordExpressionOrRecordLiteral(state: ScopeInspectionState, record: TXorNode): void {
    XorNodeUtils.assertIsRecord(record);

    // Propegates the parent's scope.
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, record.node.id, undefined);

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.RecordKeyValuePair> = NodeIdMapIterator.iterRecord(
        state.nodeIdMapCollection,
        record,
    );
    inspectKeyValuePairs(state, nodeScope, keyValuePairs, createRecordMemberScopeItem);
}

function inspectSection(state: ScopeInspectionState, section: TXorNode): void {
    XorNodeUtils.assertIsNodeKind<Ast.Section>(section, Ast.NodeKind.Section);

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.SectionKeyValuePair> = NodeIdMapIterator.iterSection(
        state.nodeIdMapCollection,
        section,
    );

    for (const kvp of keyValuePairs) {
        if (kvp.maybeValue === undefined) {
            continue;
        }

        const newScopeItems: ReadonlyArray<[string, SectionMemberScopeItem]> = scopeItemsFromKeyValuePairs(
            keyValuePairs,
            kvp.key.id,
            createSectionMemberScopeItem,
        );
        if (newScopeItems.length !== 0) {
            expandScope(state, kvp.maybeValue, newScopeItems, new Map());
        }
    }
}

// Expands the scope of the value portion for each key value pair.
function inspectKeyValuePairs<T extends TScopeItem, KVP extends NodeIdMapIterator.TKeyValuePair>(
    state: ScopeInspectionState,
    parentScope: NodeScope,
    keyValuePairs: ReadonlyArray<KVP>,
    createFn: (keyValuePair: KVP, recursive: boolean) => T,
): void {
    for (const kvp of keyValuePairs) {
        if (kvp.maybeValue === undefined) {
            continue;
        }

        const newScopeItems: ReadonlyArray<[string, T]> = scopeItemsFromKeyValuePairs(
            keyValuePairs,
            kvp.key.id,
            createFn,
        );
        if (newScopeItems.length !== 0) {
            expandScope(state, kvp.maybeValue, newScopeItems, parentScope);
        }
    }
}

function expandScope(
    state: ScopeInspectionState,
    xorNode: TXorNode,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    maybeDefaultScope: NodeScope | undefined,
): void {
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, xorNode.node.id, maybeDefaultScope);
    for (const [key, value] of newEntries) {
        nodeScope.set(value.isRecursive ? `@${key}` : key, value);
    }
}

function expandChildScope(
    state: ScopeInspectionState,
    parent: TXorNode,
    childAttributeIds: ReadonlyArray<number>,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    maybeDefaultScope: NodeScope | undefined,
): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const parentId: number = parent.node.id;

    // TODO: optimize this
    for (const attributeId of childAttributeIds) {
        const maybeChild: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
            nodeIdMapCollection,
            parentId,
            attributeId,
        );
        if (maybeChild !== undefined) {
            expandScope(state, maybeChild, newEntries, maybeDefaultScope);
        }
    }
}

// Any operation done on a scope should first invoke `scopeFor` for data integrity.
function localGetOrCreateNodeScope(
    state: ScopeInspectionState,
    nodeId: number,
    maybeDefaultScope: NodeScope | undefined,
): NodeScope {
    const trace: Trace = state.traceManager.entry(LanguageServiceTraceConstant.Scope, localGetOrCreateNodeScope.name, {
        nodeId,
    });

    // If scopeFor has already been called then there should be a nodeId in the deltaScope.
    const maybeDeltaScope: NodeScope | undefined = state.deltaScope.get(nodeId);
    if (maybeDeltaScope !== undefined) {
        trace.exit({ [TraceConstant.Result]: "deltaScope cache hit" });

        return maybeDeltaScope;
    }

    // If given a scope with an existing value then assume it's valid.
    // Cache and return.
    const maybeGivenScope: NodeScope | undefined = state.givenScope.get(nodeId);
    if (maybeGivenScope !== undefined) {
        const shallowCopy: NodeScope = new Map(maybeGivenScope.entries());
        state.deltaScope.set(nodeId, shallowCopy);
        trace.exit({ [TraceConstant.Result]: "givenScope cache hit" });

        return shallowCopy;
    }

    if (maybeDefaultScope !== undefined) {
        const shallowCopy: NodeScope = new Map(maybeDefaultScope.entries());
        state.deltaScope.set(nodeId, shallowCopy);
        trace.exit({ [TraceConstant.Result]: "defaultScope entry" });

        return shallowCopy;
    }

    // Default to a parent's scope if the node has a parent.
    const maybeParent: TXorNode | undefined = NodeIdMapUtils.maybeParentXor(state.nodeIdMapCollection, nodeId);
    if (maybeParent !== undefined) {
        const parentNodeId: number = maybeParent.node.id;

        const maybeParentDeltaScope: NodeScope | undefined = state.deltaScope.get(parentNodeId);
        if (maybeParentDeltaScope !== undefined) {
            const shallowCopy: NodeScope = new Map(maybeParentDeltaScope.entries());
            state.deltaScope.set(nodeId, shallowCopy);
            trace.exit({ [TraceConstant.Result]: "parent deltaScope hit" });

            return shallowCopy;
        }

        const maybeParentGivenScope: NodeScope | undefined = state.givenScope.get(parentNodeId);
        if (maybeParentGivenScope !== undefined) {
            const shallowCopy: NodeScope = new Map(maybeParentGivenScope.entries());
            state.deltaScope.set(nodeId, shallowCopy);
            trace.exit({ [TraceConstant.Result]: "parent givenScope hit" });

            return shallowCopy;
        }
    }

    // The node has no parent or it hasn't been visited.
    const newScope: NodeScope = new Map();
    state.deltaScope.set(nodeId, newScope);
    trace.exit({ [TraceConstant.Result]: "set new entry" });

    return newScope;
}

function scopeItemsFromKeyValuePairs<T extends TScopeItem, KVP extends NodeIdMapIterator.TKeyValuePair>(
    keyValuePairs: ReadonlyArray<KVP>,
    ancestorKeyNodeId: number,
    createFn: (keyValuePair: KVP, isRecursive: boolean) => T,
): ReadonlyArray<[string, T]> {
    return keyValuePairs
        .filter((keyValuePair: KVP) => keyValuePair.maybeValue !== undefined)
        .map((keyValuePair: KVP) => {
            return [keyValuePair.keyLiteral, createFn(keyValuePair, ancestorKeyNodeId === keyValuePair.key.id)];
        });
}

function createSectionMemberScopeItem(
    keyValuePair: NodeIdMapIterator.SectionKeyValuePair,
    isRecursive: boolean,
): SectionMemberScopeItem {
    return {
        kind: ScopeItemKind.SectionMember,
        id: keyValuePair.source.node.id,
        isRecursive,
        key: keyValuePair.key,
        maybeValue: keyValuePair.maybeValue,
    };
}

function createLetVariableScopeItem(
    keyValuePair: NodeIdMapIterator.LetKeyValuePair,
    isRecursive: boolean,
): LetVariableScopeItem {
    return {
        kind: ScopeItemKind.LetVariable,
        id: keyValuePair.source.node.id,
        isRecursive,
        key: keyValuePair.key,
        maybeValue: keyValuePair.maybeValue,
    };
}

function createRecordMemberScopeItem(
    keyValuePair: NodeIdMapIterator.RecordKeyValuePair,
    isRecursive: boolean,
): RecordFieldScopeItem {
    return {
        kind: ScopeItemKind.RecordField,
        id: keyValuePair.source.node.id,
        isRecursive,
        key: keyValuePair.key,
        maybeValue: keyValuePair.maybeValue,
    };
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { NodeIdMap, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import type { Position } from "vscode-languageserver-types";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "./activeNode";
import {
    AstNodeById,
    ChildIdsById,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser/nodeIdMap/nodeIdMap";
import { tryNodeScope as doTryNodeScope, TriedNodeScope, TScopeItem } from "./scope";
import {
    findDirectUpperScopeExpression,
    findScopeItemByLiteral,
    findTheCreatorIdentifierOfOneScopeItem,
} from "./scope/scopeUtils";
import { TriedExpectedType, tryExpectedType } from "./expectedType";
import { TriedScopeType, tryScopeType } from "./type";
import { TypeCache, TypeCacheUtils } from "./typeCache";
import { autocomplete } from "./autocomplete";
import { Inspected } from "./commonTypes";
import { Inspection } from "..";
import { InspectionSettings } from "../inspectionSettings";
import { TriedCurrentInvokeExpression } from "./invokeExpression";
import { tryCurrentInvokeExpression } from "./invokeExpression/currentInvokeExpression";

export class InspectionInstance implements Inspected {
    constructor(
        public readonly settings: InspectionSettings,
        public readonly nodeIdMapCollection: NodeIdMap.Collection,
        public readonly maybeActiveNode: TMaybeActiveNode,
        public readonly autocomplete: Inspection.Autocomplete,
        public readonly triedCurrentInvokeExpression: Promise<Inspection.TriedCurrentInvokeExpression>,
        public readonly triedNodeScope: Promise<Inspection.TriedNodeScope>,
        public readonly triedScopeType: Promise<Inspection.TriedScopeType>,
        public readonly triedExpectedType: TriedExpectedType,
        public readonly typeCache: TypeCache,
        public readonly parseState: PQP.Parser.ParseState,
    ) {}

    public tryNodeScope(id: number): Promise<TriedNodeScope> {
        return doTryNodeScope(this.settings, this.nodeIdMapCollection, id, this.typeCache.scopeById);
    }

    public async collectAllIdentifiersBeneath(
        valueCreator: Ast.Identifier | Ast.GeneralizedIdentifier,
    ): Promise<Array<Ast.Identifier | Ast.GeneralizedIdentifier>> {
        const astNodeById: AstNodeById = this.nodeIdMapCollection.astNodeById;
        const childIdsById: ChildIdsById = this.nodeIdMapCollection.childIdsById;
        const originLiteral: string = valueCreator.literal;

        const entry: Ast.TNode | undefined = findDirectUpperScopeExpression(this.nodeIdMapCollection, valueCreator.id);

        if (entry) {
            const allIdentifierIdSet: Set<number> =
                this.nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Identifier) ?? new Set();

            const allGeneralizedIdentifierIdSet: Set<number> =
                this.nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.GeneralizedIdentifier) ?? new Set();

            const current: Ast.TNode = entry;
            const idsByTiers: number[][] = [];
            let currentTier: number[] = (childIdsById.get(current.id) ?? []).slice();

            while (currentTier.length) {
                const toBePushed: number[] = currentTier.filter(
                    (one: number) => allIdentifierIdSet.has(one) || allGeneralizedIdentifierIdSet.has(one),
                );

                toBePushed.length && idsByTiers.push(toBePushed);
                currentTier = currentTier.slice();
                let nextTier: number[] = [];

                while (currentTier.length) {
                    const oneNode: number = currentTier.shift() ?? -1;
                    const childrenOfTheNode: number[] = (childIdsById.get(oneNode) ?? []).slice();
                    nextTier = nextTier.concat(childrenOfTheNode);
                }

                currentTier = nextTier;
            }

            // filter literal names
            const completeIdentifierNodes: Array<Ast.Identifier | Ast.GeneralizedIdentifier> = idsByTiers
                .flat(1)
                .map((one: number) => astNodeById.get(one))
                .filter(Boolean) as Array<Ast.Identifier | Ast.GeneralizedIdentifier>;

            let filteredIdentifierNodes: Array<Ast.Identifier | Ast.GeneralizedIdentifier> =
                completeIdentifierNodes.filter(
                    (one: Ast.Identifier | Ast.GeneralizedIdentifier) => one.literal === originLiteral,
                );

            // populate the scope items for each
            await Promise.all(
                filteredIdentifierNodes
                    .filter(
                        (oneIdentifier: Ast.Identifier | Ast.GeneralizedIdentifier) =>
                            oneIdentifier.kind === Ast.NodeKind.GeneralizedIdentifier ||
                            oneIdentifier.identifierContextKind === Ast.IdentifierContextKind.Value,
                    )
                    .map((oneIdentifier: Ast.Identifier | Ast.GeneralizedIdentifier) =>
                        this.tryNodeScope(oneIdentifier.id),
                    ),
            );

            filteredIdentifierNodes = filteredIdentifierNodes.filter(
                (oneIdentifierNode: Ast.Identifier | Ast.GeneralizedIdentifier) => {
                    if (oneIdentifierNode.kind === Ast.NodeKind.GeneralizedIdentifier) {
                        return oneIdentifierNode.id === valueCreator.id;
                    } else if (oneIdentifierNode.identifierContextKind === Ast.IdentifierContextKind.Value) {
                        const theScope: Inspection.NodeScope | undefined = this.typeCache.scopeById.get(
                            oneIdentifierNode.id,
                        );

                        const theScopeItem: TScopeItem | undefined = findScopeItemByLiteral(theScope, originLiteral);

                        const theCreatorIdentifier: Ast.Identifier | Ast.GeneralizedIdentifier | undefined =
                            findTheCreatorIdentifierOfOneScopeItem(theScopeItem);

                        return theCreatorIdentifier && theCreatorIdentifier.id === valueCreator.id;
                    } else if (
                        oneIdentifierNode.identifierContextKind === Ast.IdentifierContextKind.Key ||
                        oneIdentifierNode.identifierContextKind === Ast.IdentifierContextKind.Parameter
                    ) {
                        return oneIdentifierNode.id === valueCreator.id;
                    }

                    return false;
                },
            );

            return filteredIdentifierNodes;
        }

        return [];
    }
}

export async function inspect(
    settings: InspectionSettings,
    parseState: PQP.Parser.ParseState,
    maybeParseError: PQP.Parser.ParseError.ParseError | undefined,
    position: Position,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Promise<Inspected> {
    const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;

    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(nodeIdMapCollection, position);

    const triedCurrentInvokeExpression: Promise<TriedCurrentInvokeExpression> = tryCurrentInvokeExpression(
        settings,
        nodeIdMapCollection,
        maybeActiveNode,
        typeCache,
    );

    let triedNodeScope: Promise<TriedNodeScope>;
    let triedScopeType: Promise<TriedScopeType>;
    let triedExpectedType: TriedExpectedType;

    if (ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        const activeNode: ActiveNode = maybeActiveNode;

        triedNodeScope = doTryNodeScope(
            settings,
            nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            typeCache.scopeById,
        );

        const ancestryLeaf: TXorNode = PQP.Parser.AncestryUtils.assertGetLeaf(activeNode.ancestry);
        triedScopeType = tryScopeType(settings, nodeIdMapCollection, ancestryLeaf.node.id, typeCache);

        triedExpectedType = tryExpectedType(settings, activeNode);
    } else {
        triedNodeScope = Promise.resolve(PQP.ResultUtils.boxOk(new Map()));
        triedScopeType = Promise.resolve(PQP.ResultUtils.boxOk(new Map()));
        triedExpectedType = PQP.ResultUtils.boxOk(undefined);
    }

    return new InspectionInstance(
        settings,
        nodeIdMapCollection,
        maybeActiveNode,
        await autocomplete(settings, parseState, typeCache, maybeActiveNode, maybeParseError),
        triedCurrentInvokeExpression,
        triedNodeScope,
        triedScopeType,
        triedExpectedType,
        typeCache,
        parseState,
    );
}

export async function tryInspect(
    settings: InspectionSettings,
    text: string,
    position: Position,
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Promise<PQP.Result<Promise<Inspected>, PQP.Lexer.LexError.TLexError | PQP.Parser.ParseError.TParseError>> {
    const triedLexParse: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(settings, text);

    let parseState: PQP.Parser.ParseState;
    let maybeParseError: PQP.Parser.ParseError.ParseError | undefined;

    if (PQP.TaskUtils.isLexStageError(triedLexParse) || PQP.TaskUtils.isParseStageCommonError(triedLexParse)) {
        return PQP.ResultUtils.boxError(triedLexParse.error);
    } else if (PQP.TaskUtils.isParseStageError(triedLexParse)) {
        parseState = triedLexParse.parseState;
        maybeParseError = triedLexParse.error;
    } else {
        parseState = triedLexParse.parseState;
    }

    return PQP.ResultUtils.boxOk(inspect(settings, parseState, maybeParseError, position, typeCache));
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { CommonError } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeUtils, TMaybeActiveNode } from "../activeNode";
import { InspectionSettings } from "../settings";
import { TypeCache, TypeCacheUtils } from "../typeCache";
import { IInvokeExpression, InvokeExpressionArguments } from "./common";
import { InvokeExpression, TriedInvokeExpression, tryInvokeExpression } from "./invokeExpression";

// An inspection of the inner most invoke expression for an ActiveNode.
export type TriedCurrentInvokeExpression = PQP.Result<CurrentInvokeExpression | undefined, PQP.CommonError.CommonError>;

// Identical to InvokeExpression except maybeArguments has an extra field, `argumentOrdinal`.
export type CurrentInvokeExpression = IInvokeExpression<CurrentInvokeExpressionArguments>;

export interface CurrentInvokeExpressionArguments extends InvokeExpressionArguments {
    readonly argumentOrdinal: number;
}

export function tryCurrentInvokeExpression<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: InspectionSettings<S>,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    maybeActiveNode: TMaybeActiveNode,
    maybeTypeCache: TypeCache | undefined = undefined,
): TriedCurrentInvokeExpression {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return PQP.ResultUtils.createOk(undefined);
    }

    return PQP.ResultUtils.ensureResult(settings.locale, () =>
        inspectInvokeExpression(
            settings,
            nodeIdMapCollection,
            maybeActiveNode,
            maybeTypeCache ?? TypeCacheUtils.createEmptyCache(),
        ),
    );
}

function inspectInvokeExpression<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: InspectionSettings<S>,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    activeNode: ActiveNode,
    typeCache: TypeCache,
): CurrentInvokeExpression | undefined {
    const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;

    const maybeInvokeExpression:
        | [PQP.Parser.TXorNode, number]
        | undefined = PQP.Parser.AncestryUtils.maybeFirstXorAndIndexOfNodeKind(
        ancestry,
        PQP.Language.Ast.NodeKind.InvokeExpression,
    );

    if (!maybeInvokeExpression) {
        return undefined;
    }

    const [invokeExpressionXorNode, ancestryIndex]: [PQP.Parser.TXorNode, number] = maybeInvokeExpression;
    const triedInvokeExpression: TriedInvokeExpression = tryInvokeExpression(
        settings,
        nodeIdMapCollection,
        invokeExpressionXorNode.node.id,
        typeCache,
    );
    if (PQP.ResultUtils.isError(triedInvokeExpression)) {
        throw triedInvokeExpression;
    }

    const invokeExpression: InvokeExpression = triedInvokeExpression.value;
    const maybeArguments: InvokeExpressionArguments | undefined = invokeExpression.maybeArguments;

    let maybeWithArgumentOrdinal: CurrentInvokeExpressionArguments | undefined;
    if (maybeArguments !== undefined) {
        maybeWithArgumentOrdinal = {
            ...maybeArguments,
            argumentOrdinal: getArgumentOrdinal(
                nodeIdMapCollection,
                activeNode,
                ancestryIndex,
                invokeExpressionXorNode,
            ),
        };
    }

    return {
        ...invokeExpression,
        maybeArguments: maybeWithArgumentOrdinal,
    };
}

function getArgumentOrdinal(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    activeNode: ActiveNode,
    ancestryIndex: number,
    invokeExpressionXorNode: PQP.Parser.TXorNode,
): number {
    // `foo(1|)
    const maybeAncestoryCsv:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.AncestryUtils.maybeNthPreviousXor(activeNode.ancestry, ancestryIndex, 2, [
        PQP.Language.Ast.NodeKind.Csv,
    ]);
    if (maybeAncestoryCsv !== undefined) {
        return maybeAncestoryCsv.node.maybeAttributeIndex ?? 0;
    }

    const maybePreviousXor: PQP.Parser.TXorNode | undefined = PQP.Parser.AncestryUtils.maybePreviousXor(
        activeNode.ancestry,
        ancestryIndex,
        [
            // `foo(|)`
            PQP.Language.Ast.NodeKind.ArrayWrapper,
            // `foo(1|`
            PQP.Language.Ast.NodeKind.Constant,
        ],
    );

    let arrayWrapperXorNode: PQP.Parser.TXorNode;
    switch (maybePreviousXor?.node.kind) {
        case PQP.Language.Ast.NodeKind.Constant: {
            arrayWrapperXorNode = PQP.Parser.NodeIdMapUtils.assertGetChildXorByAttributeIndex(
                nodeIdMapCollection,
                invokeExpressionXorNode.node.id,
                1,
                [PQP.Language.Ast.NodeKind.ArrayWrapper],
            );

            break;
        }

        case PQP.Language.Ast.NodeKind.ArrayWrapper: {
            arrayWrapperXorNode = maybePreviousXor;
            break;
        }

        case undefined:
        default:
            throw new CommonError.InvariantError(`encountered an unknown scenario for getARgumentOrdinal`, {
                ancestryIndex,
                ancestryNodeKinds: activeNode.ancestry.map((xorNode: PQP.Parser.TXorNode) => xorNode.node.kind),
            });
    }

    const maybeArrayWrapperChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(
        arrayWrapperXorNode.node.id,
    );

    return maybeArrayWrapperChildIds !== undefined ? maybeArrayWrapperChildIds.length - 1 : 0;
}

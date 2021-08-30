// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { XorNodeUtils } from "../../../../../powerquery-parser/lib/powerquery-parser/parser";

import { InspectionSettings } from "../../inspectionSettings";
import { assertGetOrCreateNodeScope, NodeScope, ScopeItemKind, TScopeItem } from "../scope";
import { TriedType, tryType } from "../type";
import { TypeCache, TypeCacheUtils } from "../typeCache";
import { IInvokeExpression, InvokeExpressionArguments } from "./common";

// An inspection of an arbitrary invoke expression.
export type TriedInvokeExpression = PQP.Result<InvokeExpression, PQP.CommonError.CommonError>;

export type InvokeExpression = IInvokeExpression<InvokeExpressionArguments>;

export function tryInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    invokeExpressionId: number,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): TriedInvokeExpression {
    return PQP.ResultUtils.ensureResult(settings.locale, () =>
        inspectInvokeExpression(settings, nodeIdMapCollection, invokeExpressionId, typeCache),
    );
}

function inspectInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    invokeExpressionId: number,
    typeCache: TypeCache,
): InvokeExpression {
    settings.maybeCancellationToken?.throwIfCancelled();
    const maybeInvokeExpressionXorNode: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeXor(
        nodeIdMapCollection,
        invokeExpressionId,
    );

    if (maybeInvokeExpressionXorNode === undefined) {
        throw new PQP.CommonError.InvariantError(`expected invokeExpressionId to be present in nodeIdMapCollection`, {
            invokeExpressionId,
        });
    }
    const invokeExpressionXorNode: PQP.Parser.TXorNode = maybeInvokeExpressionXorNode;

    XorNodeUtils.assertIsInvokeExpression(invokeExpressionXorNode);

    const previousNode: PQP.Parser.TXorNode = PQP.Parser.NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        nodeIdMapCollection,
        invokeExpressionId,
    );

    const functionType: PQP.Language.Type.TPowerQueryType = Assert.unwrapOk(
        tryType(settings, nodeIdMapCollection, previousNode.node.id, typeCache),
    );
    const maybeName: string | undefined = PQP.Parser.NodeIdMapUtils.maybeInvokeExpressionIdentifierLiteral(
        nodeIdMapCollection,
        invokeExpressionId,
    );

    let maybeInvokeExpressionArgs: InvokeExpressionArguments | undefined;
    if (PQP.Language.TypeUtils.isDefinedFunction(functionType)) {
        const iterableArguments: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.NodeIdMapIterator.iterInvokeExpression(
            nodeIdMapCollection,
            invokeExpressionXorNode,
        );

        const givenArgumentTypes: ReadonlyArray<PQP.Language.Type.TPowerQueryType> = getArgumentTypes(
            settings,
            nodeIdMapCollection,
            typeCache,
            iterableArguments,
        );
        const givenArguments: ReadonlyArray<PQP.Parser.TXorNode> = iterableArguments.slice(
            0,
            givenArgumentTypes.length,
        );

        const [numMinExpectedArguments, numMaxExpectedArguments] = getNumExpectedArguments(functionType);

        maybeInvokeExpressionArgs = {
            givenArguments,
            givenArgumentTypes,
            numMaxExpectedArguments,
            numMinExpectedArguments,
            typeChecked: PQP.Language.TypeUtils.typeCheckInvocation(givenArgumentTypes, functionType),
        };
    }

    return {
        invokeExpressionXorNode,
        functionType,
        isNameInLocalScope: getIsNameInLocalScope(
            settings,
            nodeIdMapCollection,
            typeCache,
            invokeExpressionXorNode,
            maybeName,
        ),
        maybeName,
        maybeArguments: maybeInvokeExpressionArgs,
    };
}

function getIsNameInLocalScope(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    typeCache: TypeCache,
    invokeExpressionXorNode: PQP.Parser.TXorNode,
    maybeName: string | undefined,
): boolean {
    // Try to find out if the identifier is a local or external name.
    if (maybeName !== undefined) {
        // Seed local scope
        const scope: NodeScope = Assert.unwrapOk(
            assertGetOrCreateNodeScope(
                settings,
                nodeIdMapCollection,
                invokeExpressionXorNode.node.id,
                typeCache.scopeById,
            ),
        );
        const maybeNameScopeItem: TScopeItem | undefined = scope.get(maybeName);

        return maybeNameScopeItem !== undefined && maybeNameScopeItem.kind !== ScopeItemKind.Undefined;
    } else {
        return false;
    }
}

function getNumExpectedArguments(functionType: PQP.Language.Type.DefinedFunction): [number, number] {
    const nonOptionalArguments: ReadonlyArray<PQP.Language.Type.FunctionParameter> = functionType.parameters.filter(
        (parameter: PQP.Language.Type.FunctionParameter) => !parameter.isOptional,
    );

    const numMinExpectedArguments: number = nonOptionalArguments.length;
    const numMaxExpectedArguments: number = functionType.parameters.length;

    return [numMinExpectedArguments, numMaxExpectedArguments];
}

function getArgumentTypes(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    typeCache: TypeCache,
    argXorNodes: ReadonlyArray<PQP.Parser.TXorNode>,
): ReadonlyArray<PQP.Language.Type.TPowerQueryType> {
    const result: PQP.Language.Type.TPowerQueryType[] = [];

    for (const xorNode of argXorNodes) {
        const triedArgType: TriedType = tryType(settings, nodeIdMapCollection, xorNode.node.id, typeCache);
        if (PQP.ResultUtils.isError(triedArgType)) {
            throw triedArgType;
        }
        const argType: PQP.Language.Type.TPowerQueryType = triedArgType.value;

        // Occurs when there's expected to be a trailing argument, but none exist.
        // Eg. `foo(|` will iterate over an TXorNode which: contains no parsed elements, and evaluates to unknown.
        if (
            PQP.Language.TypeUtils.isUnknown(argType) &&
            !PQP.Parser.NodeIdMapUtils.hasParsedToken(nodeIdMapCollection, xorNode.node.id)
        ) {
            Assert.isTrue(xorNode === argXorNodes[argXorNodes.length - 1]);
            return result;
        }

        result.push(argType);
    }

    return result;
}

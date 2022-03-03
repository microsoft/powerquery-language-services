// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import {
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { assertGetOrCreateNodeScope, NodeScope, ScopeItemKind, TScopeItem } from "../scope";
import { IInvokeExpression, InvokeExpressionArguments } from "./common";
import { TriedType, tryType } from "../type";
import { TypeCache, TypeCacheUtils } from "../typeCache";
import { InspectionSettings } from "../../inspectionSettings";

// An inspection of an arbitrary invoke expression.
export type TriedInvokeExpression = PQP.Result<InvokeExpression, PQP.CommonError.CommonError>;

export type InvokeExpression = IInvokeExpression<InvokeExpressionArguments>;

export function tryInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    invokeExpressionId: number,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Promise<TriedInvokeExpression> {
    return ResultUtils.ensureResultAsync(settings.locale, () =>
        inspectInvokeExpression(settings, nodeIdMapCollection, invokeExpressionId, typeCache),
    );
}

async function inspectInvokeExpression(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    invokeExpressionId: number,
    typeCache: TypeCache,
): Promise<InvokeExpression> {
    settings.maybeCancellationToken?.throwIfCancelled();

    const maybeInvokeExpressionXorNode: TXorNode | undefined = NodeIdMapUtils.maybeXor(
        nodeIdMapCollection,
        invokeExpressionId,
    );

    if (maybeInvokeExpressionXorNode === undefined) {
        throw new PQP.CommonError.InvariantError(`expected invokeExpressionId to be present in nodeIdMapCollection`, {
            invokeExpressionId,
        });
    }

    const invokeExpressionXorNode: TXorNode = maybeInvokeExpressionXorNode;

    XorNodeUtils.assertIsInvokeExpression(invokeExpressionXorNode);

    const previousNode: TXorNode = NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        nodeIdMapCollection,
        invokeExpressionId,
    );

    const functionType: Type.TPowerQueryType = Assert.unboxOk(
        await tryType(settings, nodeIdMapCollection, previousNode.node.id, typeCache),
    );

    const maybeName: string | undefined = NodeIdMapUtils.maybeInvokeExpressionIdentifierLiteral(
        nodeIdMapCollection,
        invokeExpressionId,
    );

    let maybeInvokeExpressionArgs: InvokeExpressionArguments | undefined;

    if (TypeUtils.isDefinedFunction(functionType)) {
        const iterableArguments: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterInvokeExpression(
            nodeIdMapCollection,
            invokeExpressionXorNode,
        );

        const givenArgumentTypes: ReadonlyArray<Type.TPowerQueryType> = await getArgumentTypes(
            settings,
            nodeIdMapCollection,
            typeCache,
            iterableArguments,
        );

        const givenArguments: ReadonlyArray<TXorNode> = iterableArguments.slice(0, givenArgumentTypes.length);

        const [numMinExpectedArguments, numMaxExpectedArguments]: [number, number] =
            getNumExpectedArguments(functionType);

        maybeInvokeExpressionArgs = {
            givenArguments,
            givenArgumentTypes,
            numMaxExpectedArguments,
            numMinExpectedArguments,
            typeChecked: TypeUtils.typeCheckInvocation(givenArgumentTypes, functionType),
        };
    }

    return {
        invokeExpressionXorNode,
        functionType,
        isNameInLocalScope: await getIsNameInLocalScope(
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

async function getIsNameInLocalScope(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    typeCache: TypeCache,
    invokeExpressionXorNode: TXorNode,
    maybeName: string | undefined,
): Promise<boolean> {
    // Try to find out if the identifier is a local or external name.
    if (maybeName !== undefined) {
        // Seed local scope
        const scope: NodeScope = Assert.unboxOk(
            await assertGetOrCreateNodeScope(
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

function getNumExpectedArguments(functionType: Type.DefinedFunction): [number, number] {
    const nonOptionalArguments: ReadonlyArray<Type.FunctionParameter> = functionType.parameters.filter(
        (parameter: Type.FunctionParameter) => !parameter.isOptional,
    );

    const numMinExpectedArguments: number = nonOptionalArguments.length;
    const numMaxExpectedArguments: number = functionType.parameters.length;

    return [numMinExpectedArguments, numMaxExpectedArguments];
}

async function getArgumentTypes(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    typeCache: TypeCache,
    argXorNodes: ReadonlyArray<TXorNode>,
): Promise<ReadonlyArray<Type.TPowerQueryType>> {
    const result: Type.TPowerQueryType[] = [];

    for (const xorNode of argXorNodes) {
        // eslint-disable-next-line no-await-in-loop
        const triedArgType: TriedType = await tryType(settings, nodeIdMapCollection, xorNode.node.id, typeCache);

        if (ResultUtils.isError(triedArgType)) {
            throw triedArgType;
        }

        const argType: Type.TPowerQueryType = triedArgType.value;

        // Occurs when there's expected to be a trailing argument, but none exist.
        // Eg. `foo(|` will iterate over an TXorNode which: contains no parsed elements, and evaluates to unknown.
        if (TypeUtils.isUnknown(argType) && !NodeIdMapUtils.hasParsedToken(nodeIdMapCollection, xorNode.node.id)) {
            Assert.isTrue(xorNode === argXorNodes[argXorNodes.length - 1]);

            return result;
        }

        result.push(argType);
    }

    return result;
}

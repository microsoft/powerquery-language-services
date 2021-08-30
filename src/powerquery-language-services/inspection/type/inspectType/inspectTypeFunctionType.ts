// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { XorNodeUtils } from "../../../../../../powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeFunctionType(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.FunctionType | PQP.Language.Type.Unknown {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind(xorNode, PQP.Language.Ast.NodeKind.FunctionType);

    const maybeParameters:
        | PQP.Parser.XorNode<PQP.Language.Ast.TParameterList>
        | undefined = PQP.Parser.NodeIdMapUtils.maybeNthChildChecked<PQP.Language.Ast.TParameterList>(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        PQP.Language.Ast.NodeKind.ParameterList,
    );
    if (maybeParameters === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }

    const maybeArrayWrapper:
        | PQP.Parser.XorNode<PQP.Language.Ast.TArrayWrapper>
        | undefined = PQP.Parser.NodeIdMapUtils.maybeUnwrapArrayWrapper(
        state.nodeIdMapCollection,
        maybeParameters.node.id,
    );
    if (maybeArrayWrapper === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }

    const parameterTypes: ReadonlyArray<PQP.Language.Type.FunctionParameter> = PQP.Parser.NodeIdMapIterator.iterArrayWrapper(
        state.nodeIdMapCollection,
        maybeArrayWrapper,
    )
        .map((parameter: PQP.Parser.TXorNode) =>
            PQP.Language.TypeUtils.inspectParameter(
                state.nodeIdMapCollection,
                XorNodeUtils.assertAsParameter(parameter),
            ),
        )
        .filter(PQP.TypeScriptUtils.isDefined);

    const returnType: PQP.Language.Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 2);

    return {
        kind: PQP.Language.Type.TypeKind.Type,
        maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.FunctionType,
        isNullable: false,
        parameters: parameterTypes,
        returnType,
    };
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { allForAnyUnion, inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeFunctionExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.FunctionExpression);

    const inspectedFunctionExpression: PQP.Language.TypeInspector.InspectedFunctionExpression = PQP.Language.TypeInspector.inspectFunctionExpression(
        state.nodeIdMapCollection,
        xorNode,
    );
    const inspectedReturnType: PQP.Language.Type.TType = inspectedFunctionExpression.returnType;
    const expressionType: PQP.Language.Type.TType = inspectTypeFromChildAttributeIndex(state, xorNode, 3);

    // FunctionExpression.maybeFunctionReturnType doesn't always match FunctionExpression.expression.
    // By examining the expression we might get a more accurate return type (eg. Function vs DefinedFunction),
    // or discover an error (eg. maybeFunctionReturnType is Number but expression is Text).

    let returnType: PQP.Language.Type.TType;
    // If the stated return type is Any,
    // then it might as well be the expression's type as it can't be any wider than Any.
    if (inspectedReturnType.kind === PQP.Language.Type.TypeKind.Any) {
        returnType = expressionType;
    }
    // If the return type is Any then see if we can narrow it to the stated return PQP.Language.type.
    else if (
        expressionType.kind === PQP.Language.Type.TypeKind.Any &&
        expressionType.maybeExtendedKind === PQP.Language.Type.ExtendedTypeKind.AnyUnion &&
        allForAnyUnion(
            expressionType,
            (type: PQP.Language.Type.TType) =>
                type.kind === inspectedReturnType.kind || type.kind === PQP.Language.Type.TypeKind.Any,
        )
    ) {
        returnType = expressionType;
    }
    // If the stated return type doesn't match the expression's type then it's None.
    else if (inspectedReturnType.kind !== expressionType.kind) {
        return PQP.Language.Type.NoneInstance;
    }
    // If the expression's type can't be known, then assume it's the stated return PQP.Language.type.
    else if (expressionType.kind === PQP.Language.Type.TypeKind.Unknown) {
        returnType = inspectedReturnType;
    }
    // Else fallback to the expression's PQP.Language.type.
    else {
        returnType = expressionType;
    }

    return {
        kind: PQP.Language.Type.TypeKind.Function,
        maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.DefinedFunction,
        isNullable: false,
        parameters: inspectedFunctionExpression.parameters.map(
            (parameter: PQP.Language.TypeInspector.InspectedFunctionParameter) => {
                return {
                    nameLiteral: parameter.name.literal,
                    isNullable: parameter.isNullable,
                    isOptional: parameter.isOptional,
                    maybeType: parameter.maybeType,
                };
            },
        ),
        returnType,
    };
}

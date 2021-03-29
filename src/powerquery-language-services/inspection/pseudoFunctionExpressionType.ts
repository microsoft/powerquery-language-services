// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

// A type for a potentially incomplete function expression.
export interface PseduoFunctionExpressionType {
    readonly parameters: ReadonlyArray<PseudoFunctionParameterType>;
    readonly returnType: PQP.Language.Type.TPrimitiveType;
}

// Omit "nameLiteral" since we're going to include the `name` identifier.
export interface PseudoFunctionParameterType extends Omit<PQP.Language.Type.FunctionParameter, "nameLiteral"> {
    readonly id: number;
    readonly name: PQP.Language.Ast.Identifier;
}

export function pseudoFunctionExpressionType(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    fnExpr: PQP.Parser.TXorNode,
): PseduoFunctionExpressionType {
    PQP.Parser.XorNodeUtils.assertAstNodeKind(fnExpr, PQP.Language.Ast.NodeKind.FunctionExpression);

    const examinedParameters: PseudoFunctionParameterType[] = [];
    // Iterates all parameters as TXorNodes if they exist, otherwise early exists from an empty list.
    for (const parameter of functionParameterXorNodes(nodeIdMapCollection, fnExpr)) {
        // A parameter isn't examinable if it doesn't have an PQP.Language.Ast.Identifier for its name.
        const maybeName:
            | PQP.Language.Ast.Identifier
            | undefined = PQP.Parser.NodeIdMapUtils.maybeChildAstByAttributeIndex(
            nodeIdMapCollection,
            parameter.node.id,
            1,
            [PQP.Language.Ast.NodeKind.Identifier],
        ) as PQP.Language.Ast.Identifier;
        if (maybeName === undefined) {
            break;
        }

        const maybeExaminable:
            | PQP.Language.Type.FunctionParameter
            | undefined = PQP.Language.TypeUtils.inspectParameter(nodeIdMapCollection, parameter);
        if (maybeExaminable !== undefined) {
            examinedParameters.push({
                ...maybeExaminable,
                id: parameter.node.id,
                name: maybeName,
            });
        }
    }

    const maybeReturnType:
        | PQP.Language.Ast.TNode
        | undefined = PQP.Parser.NodeIdMapUtils.maybeChildAstByAttributeIndex(nodeIdMapCollection, fnExpr.node.id, 1, [
        PQP.Language.Ast.NodeKind.AsNullablePrimitiveType,
    ]);

    let isReturnNullable: boolean;
    let returnType: PQP.Language.Type.TypeKind;
    if (maybeReturnType !== undefined) {
        const simplified: PQP.Language.AstUtils.SimplifiedType = PQP.Language.AstUtils.simplifyAsNullablePrimitiveType(
            maybeReturnType as PQP.Language.Ast.AsNullablePrimitiveType,
        );
        isReturnNullable = simplified.isNullable;
        returnType = PQP.Language.TypeUtils.typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind);
    } else {
        isReturnNullable = true;
        returnType = PQP.Language.Type.TypeKind.Any;
    }

    return {
        parameters: examinedParameters,
        returnType: {
            kind: returnType,
            maybeExtendedKind: undefined,
            isNullable: isReturnNullable,
        },
    };
}

function functionParameterXorNodes(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    fnExpr: PQP.Parser.TXorNode,
): ReadonlyArray<PQP.Parser.TXorNode> {
    const maybeParameterList:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(nodeIdMapCollection, fnExpr.node.id, 0, [
        PQP.Language.Ast.NodeKind.ParameterList,
    ]);
    if (maybeParameterList === undefined) {
        return [];
    }
    const maybeWrappedContent: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeArrayWrapperContent(
        nodeIdMapCollection,
        maybeParameterList,
    );

    return maybeWrappedContent === undefined
        ? []
        : PQP.Parser.NodeIdMapIterator.iterArrayWrapper(nodeIdMapCollection, maybeWrappedContent);
}

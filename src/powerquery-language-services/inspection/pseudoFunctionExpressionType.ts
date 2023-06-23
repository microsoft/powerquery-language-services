// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, AstUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

// A type for a potentially incomplete function expression.
export interface PseduoFunctionExpressionType {
    readonly parameters: ReadonlyArray<PseudoFunctionParameterType>;
    readonly returnType: Type.TPrimitiveType;
}

// Omit "nameLiteral" since we're going to include the `name` identifier.
export interface PseudoFunctionParameterType extends Omit<Type.FunctionParameter, "nameLiteral"> {
    readonly id: number;
    readonly name: Ast.Identifier;
}

export function pseudoFunctionExpressionType(
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpr: TXorNode,
): PseduoFunctionExpressionType {
    XorNodeUtils.assertIsNodeKind<Ast.FunctionExpression>(fnExpr, Ast.NodeKind.FunctionExpression);

    const examinedParameters: PseudoFunctionParameterType[] = [];

    // Iterates all parameters as TXorNodes if they exist, otherwise early exists from an empty list.
    for (const parameter of functionParameterXorNodes(nodeIdMapCollection, fnExpr)) {
        // A parameter isn't examinable if it doesn't have an Ast.Identifier for its name.
        const name: Ast.Identifier | undefined = NodeIdMapUtils.nthChildAstChecked<Ast.Identifier>(
            nodeIdMapCollection,
            parameter.node.id,
            1,
            Ast.NodeKind.Identifier,
        );

        if (name === undefined) {
            break;
        }

        const examinable: Type.FunctionParameter | undefined = TypeUtils.inspectParameter(
            nodeIdMapCollection,
            XorNodeUtils.assertAsNodeKind<Ast.TParameter>(parameter, Ast.NodeKind.Parameter),
        );

        if (examinable !== undefined) {
            examinedParameters.push({
                id: parameter.node.id,
                isNullable: examinable.isNullable,
                isOptional: examinable.isOptional,
                type: examinable.type,
                name,
            });
        }
    }

    const returnType: Ast.AsNullablePrimitiveType | undefined =
        NodeIdMapUtils.nthChildAstChecked<Ast.AsNullablePrimitiveType>(
            nodeIdMapCollection,
            fnExpr.node.id,
            1,
            Ast.NodeKind.AsNullablePrimitiveType,
        );

    let isReturnNullable: boolean;
    let returnTypeKind: Type.TypeKind;

    if (returnType !== undefined) {
        const simplified: AstUtils.SimplifiedType = AstUtils.simplifyAsNullablePrimitiveType(returnType);
        isReturnNullable = simplified.isNullable;
        returnTypeKind = TypeUtils.typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind);
    } else {
        isReturnNullable = true;
        returnTypeKind = Type.TypeKind.Any;
    }

    return {
        parameters: examinedParameters,
        returnType: {
            kind: returnTypeKind,
            extendedKind: undefined,
            isNullable: isReturnNullable,
        },
    };
}

function functionParameterXorNodes(
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpr: TXorNode,
): ReadonlyArray<TXorNode> {
    const parametersList: XorNode<Ast.TParameterList> | undefined =
        NodeIdMapUtils.nthChildXorChecked<Ast.TParameterList>(
            nodeIdMapCollection,
            fnExpr.node.id,
            0,
            Ast.NodeKind.ParameterList,
        );

    if (parametersList === undefined) {
        return [];
    }

    const wrappedContent: TXorNode | undefined = NodeIdMapUtils.wrappedContentXor(
        nodeIdMapCollection,
        parametersList.node.id,
    );

    return wrappedContent === undefined ? [] : NodeIdMapIterator.iterArrayWrapper(nodeIdMapCollection, wrappedContent);
}

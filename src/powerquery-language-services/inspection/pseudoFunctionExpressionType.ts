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
        const maybeName: Ast.Identifier | undefined = NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.Identifier>(
            nodeIdMapCollection,
            parameter.node.id,
            1,
            Ast.NodeKind.Identifier,
        );

        if (maybeName === undefined) {
            break;
        }

        const maybeExaminable: Type.FunctionParameter | undefined = TypeUtils.inspectParameter(
            nodeIdMapCollection,
            XorNodeUtils.assertAsParameter(parameter),
        );

        if (maybeExaminable !== undefined) {
            examinedParameters.push({
                id: parameter.node.id,
                isNullable: maybeExaminable.isNullable,
                isOptional: maybeExaminable.isOptional,
                maybeType: maybeExaminable.maybeType,
                name: maybeName,
            });
        }
    }

    const maybeReturnType: Ast.AsNullablePrimitiveType | undefined =
        NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.AsNullablePrimitiveType>(
            nodeIdMapCollection,
            fnExpr.node.id,
            1,
            Ast.NodeKind.AsNullablePrimitiveType,
        );

    let isReturnNullable: boolean;
    let returnType: Type.TypeKind;

    if (maybeReturnType !== undefined) {
        const simplified: AstUtils.SimplifiedType = AstUtils.simplifyAsNullablePrimitiveType(maybeReturnType);
        isReturnNullable = simplified.isNullable;
        returnType = TypeUtils.typeKindFromPrimitiveTypeConstantKind(simplified.primitiveTypeConstantKind);
    } else {
        isReturnNullable = true;
        returnType = Type.TypeKind.Any;
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
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpr: TXorNode,
): ReadonlyArray<TXorNode> {
    const maybeParameterList: XorNode<Ast.TParameterList> | undefined =
        NodeIdMapUtils.maybeNthChildChecked<Ast.TParameterList>(
            nodeIdMapCollection,
            fnExpr.node.id,
            0,
            Ast.NodeKind.ParameterList,
        );

    if (maybeParameterList === undefined) {
        return [];
    }

    const maybeWrappedContent: TXorNode | undefined = NodeIdMapUtils.maybeUnboxWrappedContent(
        nodeIdMapCollection,
        maybeParameterList.node.id,
    );

    return maybeWrappedContent === undefined
        ? []
        : NodeIdMapIterator.iterArrayWrapper(nodeIdMapCollection, maybeWrappedContent);
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { Assert } from "@microsoft/powerquery-parser";
export function inspectTypeLiteralExpression(
    xorNode: TXorNode,
): Type.TPrimitiveType | Type.TextLiteral | Type.NumberLiteral {
    XorNodeUtils.assertIsNodeKind<Ast.LiteralExpression>(xorNode, Ast.NodeKind.LiteralExpression);

    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            // We already checked it's a Ast Literal Expression.
            const literalExpression: Ast.LiteralExpression = xorNode.node;
            const typeKind: Type.TypeKind = TypeUtils.typeKindFromLiteralKind(literalExpression.literalKind);

            switch (typeKind) {
                case Type.TypeKind.Number:
                    return TypeUtils.createNumberLiteral(false, literalExpression.literal);

                case Type.TypeKind.Text:
                    return TypeUtils.createTextLiteral(false, literalExpression.literal);

                default:
                    return TypeUtils.createPrimitiveType(
                        literalExpression.literalKind === Ast.LiteralKind.Null,
                        typeKind,
                    );
            }

        case XorNodeKind.Context:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(xorNode);
    }
}

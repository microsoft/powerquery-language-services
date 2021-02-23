// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

export function inspectTypeLiteralExpression(
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPrimitiveType | PQP.Language.Type.TextLiteral | PQP.Language.Type.NumberLiteral {
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.LiteralExpression);

    switch (xorNode.kind) {
        case PQP.Parser.XorNodeKind.Ast:
            // We already checked it's a Ast Literal Expression.
            const literalExpression: PQP.Language.Ast.LiteralExpression = xorNode.node as PQP.Language.Ast.LiteralExpression;
            const typeKind: PQP.Language.Type.TypeKind = PQP.Language.TypeUtils.typeKindFromLiteralKind(
                literalExpression.literalKind,
            );

            switch (typeKind) {
                case PQP.Language.Type.TypeKind.Number:
                    return PQP.Language.TypeUtils.numberLiteralFactory(false, literalExpression.literal);

                case PQP.Language.Type.TypeKind.Text:
                    return PQP.Language.TypeUtils.textLiteralFactory(false, literalExpression.literal);

                default:
                    return PQP.Language.TypeUtils.primitiveTypeFactory(
                        literalExpression.literalKind === PQP.Language.Ast.LiteralKind.Null,
                        typeKind,
                    );
            }

        case PQP.Parser.XorNodeKind.Context:
            return PQP.Language.Type.UnknownInstance;

        default:
            throw Assert.isNever(xorNode);
    }
}

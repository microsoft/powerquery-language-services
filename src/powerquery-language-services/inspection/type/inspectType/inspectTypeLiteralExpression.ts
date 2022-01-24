// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeKind, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert } from "@microsoft/powerquery-parser";

import { LanguageServiceTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState } from ".";

export function inspectTypeLiteralExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
): Type.TPrimitiveType | Type.TextLiteral | Type.NumberLiteral {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeLiteralExpression.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    XorNodeUtils.assertIsNodeKind<Ast.LiteralExpression>(xorNode, Ast.NodeKind.LiteralExpression);

    let literalExpression: Ast.LiteralExpression | undefined;
    let typeKind: Type.TypeKind | undefined;
    let result: Type.TPowerQueryType;

    switch (xorNode.kind) {
        case XorNodeKind.Ast: {
            // We already checked it's a Ast Literal Expression.
            literalExpression = xorNode.node;
            typeKind = TypeUtils.typeKindFromLiteralKind(literalExpression.literalKind);

            switch (typeKind) {
                case Type.TypeKind.Number:
                    result = TypeUtils.createNumberLiteral(false, literalExpression.literal);
                    break;

                case Type.TypeKind.Text:
                    result = TypeUtils.createTextLiteral(false, literalExpression.literal);
                    break;

                default:
                    result = TypeUtils.createPrimitiveType(
                        literalExpression.literalKind === Ast.LiteralKind.Null,
                        typeKind,
                    );

                    break;
            }

            break;
        }

        case XorNodeKind.Context:
            result = Type.UnknownInstance;
            break;

        default:
            throw Assert.isNever(xorNode);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export function inspectTypePrimitiveType(xorNode: TXorNode): Type.TPowerQueryType {
    XorNodeUtils.assertIsNodeKind<Ast.PrimitiveType>(xorNode, Ast.NodeKind.PrimitiveType);

    if (XorNodeUtils.isContextXor(xorNode)) {
        return Type.UnknownInstance;
    }

    const kind: Type.TypeKind = TypeUtils.typeKindFromPrimitiveTypeConstantKind(xorNode.node.primitiveTypeKind);
    return {
        kind,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}

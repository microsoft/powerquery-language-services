// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export function inspectTypePrimitiveType(xorNode: PQP.Parser.TXorNode): PQP.Language.Type.TPowerQueryType {
    PQP.Parser.XorNodeUtils.assertIsNodeKind(xorNode, PQP.Language.Ast.NodeKind.PrimitiveType);

    if (xorNode.kind === PQP.Parser.XorNodeKind.Context) {
        return PQP.Language.Type.UnknownInstance;
    }

    const kind: PQP.Language.Type.TypeKind = PQP.Language.TypeUtils.typeKindFromPrimitiveTypeConstantKind(
        (xorNode.node as PQP.Language.Ast.PrimitiveType).primitiveTypeKind,
    );
    return {
        kind,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}

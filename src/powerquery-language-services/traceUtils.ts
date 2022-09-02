// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export function createTypeDetails(powerQueryType: Type.TPowerQueryType): TypeDetails {
    return {
        kind: powerQueryType.kind,
        extendedType: powerQueryType.extendedKind,
        isNullable: powerQueryType.isNullable,
    };
}

export function createXorNodeDetails(xorNode: TXorNode): XorNodeDetails {
    return {
        nodeKind: xorNode.node.kind,
        nodeId: xorNode.node.id,
    };
}

interface TypeDetails {
    readonly kind: Type.TypeKind;
    readonly extendedType: Type.ExtendedTypeKind | undefined;
    readonly isNullable: boolean;
}

interface XorNodeDetails {
    readonly nodeId: number;
    readonly nodeKind: Ast.NodeKind;
}

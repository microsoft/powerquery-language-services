// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export function inspectTypeConstant(xorNode: PQP.Parser.TXorNode): PQP.Language.Type.TPowerQueryType {
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.Constant);

    if (xorNode.kind === PQP.Parser.XorNodeKind.Context) {
        return PQP.Language.Type.UnknownInstance;
    }

    const constant: PQP.Language.Ast.TConstant = xorNode.node as PQP.Language.Ast.TConstant;
    switch (constant.constantKind) {
        case PQP.Language.Constant.PrimitiveTypeConstantKind.Action:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Action);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Any:
            return PQP.Language.Type.AnyInstance;

        case PQP.Language.Constant.PrimitiveTypeConstantKind.AnyNonNull:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.AnyNonNull);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Binary:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Binary);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Date:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Date);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.DateTime:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.DateTime);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.DateTimeZone:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.DateTimeZone);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Duration:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Duration);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Function:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Function);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.List:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.List);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Logical:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Logical);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.None:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.None);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Null:
            return PQP.Language.Type.NoneInstance;

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Number:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Number);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Record:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Record);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Table:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Table);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Text:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Text);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Time:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Time);

        case PQP.Language.Constant.PrimitiveTypeConstantKind.Type:
            return PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Type);

        default:
            return PQP.Language.Type.UnknownInstance;
    }
}

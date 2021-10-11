// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export function inspectTypeConstant(xorNode: TXorNode): Type.TPowerQueryType {
    XorNodeUtils.assertIsNodeKind<Ast.TConstant>(xorNode, Ast.NodeKind.Constant);

    if (XorNodeUtils.isContextXor(xorNode)) {
        return Type.UnknownInstance;
    }

    const constant: Ast.TConstant = xorNode.node;
    switch (constant.constantKind) {
        case Constant.PrimitiveTypeConstant.Action:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Action);

        case Constant.PrimitiveTypeConstant.Any:
            return Type.AnyInstance;

        case Constant.PrimitiveTypeConstant.AnyNonNull:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.AnyNonNull);

        case Constant.PrimitiveTypeConstant.Binary:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Binary);

        case Constant.PrimitiveTypeConstant.Date:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Date);

        case Constant.PrimitiveTypeConstant.DateTime:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.DateTime);

        case Constant.PrimitiveTypeConstant.DateTimeZone:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.DateTimeZone);

        case Constant.PrimitiveTypeConstant.Duration:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Duration);

        case Constant.PrimitiveTypeConstant.Function:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Function);

        case Constant.PrimitiveTypeConstant.List:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.List);

        case Constant.PrimitiveTypeConstant.Logical:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical);

        case Constant.PrimitiveTypeConstant.None:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.None);

        case Constant.PrimitiveTypeConstant.Null:
            return Type.NoneInstance;

        case Constant.PrimitiveTypeConstant.Number:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Number);

        case Constant.PrimitiveTypeConstant.Record:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Record);

        case Constant.PrimitiveTypeConstant.Table:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Table);

        case Constant.PrimitiveTypeConstant.Text:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Text);

        case Constant.PrimitiveTypeConstant.Time:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Time);

        case Constant.PrimitiveTypeConstant.Type:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Type);

        default:
            return Type.UnknownInstance;
    }
}

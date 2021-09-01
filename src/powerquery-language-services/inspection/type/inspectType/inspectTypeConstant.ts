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
        case Constant.PrimitiveTypeConstantKind.Action:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Action);

        case Constant.PrimitiveTypeConstantKind.Any:
            return Type.AnyInstance;

        case Constant.PrimitiveTypeConstantKind.AnyNonNull:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.AnyNonNull);

        case Constant.PrimitiveTypeConstantKind.Binary:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Binary);

        case Constant.PrimitiveTypeConstantKind.Date:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Date);

        case Constant.PrimitiveTypeConstantKind.DateTime:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.DateTime);

        case Constant.PrimitiveTypeConstantKind.DateTimeZone:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.DateTimeZone);

        case Constant.PrimitiveTypeConstantKind.Duration:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Duration);

        case Constant.PrimitiveTypeConstantKind.Function:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Function);

        case Constant.PrimitiveTypeConstantKind.List:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.List);

        case Constant.PrimitiveTypeConstantKind.Logical:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical);

        case Constant.PrimitiveTypeConstantKind.None:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.None);

        case Constant.PrimitiveTypeConstantKind.Null:
            return Type.NoneInstance;

        case Constant.PrimitiveTypeConstantKind.Number:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Number);

        case Constant.PrimitiveTypeConstantKind.Record:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Record);

        case Constant.PrimitiveTypeConstantKind.Table:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Table);

        case Constant.PrimitiveTypeConstantKind.Text:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Text);

        case Constant.PrimitiveTypeConstantKind.Time:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Time);

        case Constant.PrimitiveTypeConstantKind.Type:
            return TypeUtils.createPrimitiveType(false, Type.TypeKind.Type);

        default:
            return Type.UnknownInstance;
    }
}

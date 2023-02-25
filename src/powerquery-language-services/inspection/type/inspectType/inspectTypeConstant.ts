// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export function inspectTypeConstant(xorNode: TXorNode): Type.TPowerQueryType {
    XorNodeUtils.assertIsNodeKind<Ast.TConstant>(xorNode, Ast.NodeKind.Constant);

    if (XorNodeUtils.isContextXor(xorNode)) {
        return Type.UnknownInstance;
    }

    const constant: Ast.TConstant = xorNode.node;

    switch (constant.constantKind) {
        case Constant.PrimitiveTypeConstant.Action:
            return Type.ActionInstance;

        case Constant.PrimitiveTypeConstant.Any:
            return Type.AnyInstance;

        case Constant.PrimitiveTypeConstant.AnyNonNull:
            return Type.AnyNonNullInstance;

        case Constant.PrimitiveTypeConstant.Binary:
            return Type.BinaryInstance;

        case Constant.PrimitiveTypeConstant.Date:
            return Type.DateInstance;

        case Constant.PrimitiveTypeConstant.DateTime:
            return Type.DateTimeInstance;

        case Constant.PrimitiveTypeConstant.DateTimeZone:
            return Type.DateTimeZoneInstance;

        case Constant.PrimitiveTypeConstant.Duration:
            return Type.DurationInstance;

        case Constant.PrimitiveTypeConstant.Function:
            return Type.FunctionInstance;

        case Constant.PrimitiveTypeConstant.List:
            return Type.ListInstance;

        case Constant.PrimitiveTypeConstant.Logical:
            return Type.LogicalInstance;

        case Constant.PrimitiveTypeConstant.None:
            return Type.NoneInstance;

        case Constant.PrimitiveTypeConstant.Null:
            return Type.NoneInstance;

        case Constant.PrimitiveTypeConstant.Number:
            return Type.NumberInstance;

        case Constant.PrimitiveTypeConstant.Record:
            return Type.RecordInstance;

        case Constant.PrimitiveTypeConstant.Table:
            return Type.TableInstance;

        case Constant.PrimitiveTypeConstant.Text:
            return Type.TextInstance;

        case Constant.PrimitiveTypeConstant.Time:
            return Type.TimeInstance;

        case Constant.PrimitiveTypeConstant.Type:
            return Type.TypePrimitiveInstance;

        default:
            return Type.UnknownInstance;
    }
}

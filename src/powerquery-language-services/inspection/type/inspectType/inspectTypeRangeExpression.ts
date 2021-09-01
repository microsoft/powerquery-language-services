// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeRangeExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.RangeExpression>(xorNode, Ast.NodeKind.RangeExpression);

    const maybeLeftType: Type.TPowerQueryType | undefined = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
    const maybeRightType: Type.TPowerQueryType | undefined = inspectTypeFromChildAttributeIndex(state, xorNode, 2);

    if (maybeLeftType === undefined || maybeRightType === undefined) {
        return Type.UnknownInstance;
    } else if (maybeLeftType.kind === Type.TypeKind.Number && maybeRightType.kind === Type.TypeKind.Number) {
        // TODO: handle isNullable better
        if (maybeLeftType.isNullable === true || maybeRightType.isNullable === true) {
            return Type.NoneInstance;
        } else {
            return TypeUtils.createPrimitiveType(maybeLeftType.isNullable, maybeLeftType.kind);
        }
    } else if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
        return Type.NoneInstance;
    } else if (maybeLeftType.kind === Type.TypeKind.Unknown || maybeRightType.kind === Type.TypeKind.Unknown) {
        return Type.UnknownInstance;
    } else {
        return Type.NoneInstance;
    }
}

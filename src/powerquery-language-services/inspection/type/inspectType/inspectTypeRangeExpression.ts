// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeRangeExpression<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.RangeExpression);

    const maybeLeftType: PQP.Language.Type.TPowerQueryType | undefined = inspectTypeFromChildAttributeIndex(
        state,
        xorNode,
        0,
    );
    const maybeRightType: PQP.Language.Type.TPowerQueryType | undefined = inspectTypeFromChildAttributeIndex(
        state,
        xorNode,
        2,
    );

    if (maybeLeftType === undefined || maybeRightType === undefined) {
        return PQP.Language.Type.UnknownInstance;
    } else if (
        maybeLeftType.kind === PQP.Language.Type.TypeKind.Number &&
        maybeRightType.kind === PQP.Language.Type.TypeKind.Number
    ) {
        // TODO: handle isNullable better
        if (maybeLeftType.isNullable === true || maybeRightType.isNullable === true) {
            return PQP.Language.Type.NoneInstance;
        } else {
            return PQP.Language.TypeUtils.createPrimitiveType(maybeLeftType.isNullable, maybeLeftType.kind);
        }
    } else if (
        maybeLeftType.kind === PQP.Language.Type.TypeKind.None ||
        maybeRightType.kind === PQP.Language.Type.TypeKind.None
    ) {
        return PQP.Language.Type.NoneInstance;
    } else if (
        maybeLeftType.kind === PQP.Language.Type.TypeKind.Unknown ||
        maybeRightType.kind === PQP.Language.Type.TypeKind.Unknown
    ) {
        return PQP.Language.Type.UnknownInstance;
    } else {
        return PQP.Language.Type.NoneInstance;
    }
}

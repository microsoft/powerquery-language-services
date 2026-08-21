// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, TextUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectTypeState } from "./inspectTypeState";
import { inspectXor } from "./common";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeHashTableInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    if (state.typeStrategy === TypeStrategy.Primitive) {
        return Type.TableInstance;
    }

    const [columns]: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterInvokeExpression(
        state.nodeIdMapCollection,
        XorNodeUtils.assertAsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression),
    );

    if (columns === undefined) {
        return Type.TableInstance;
    }

    return definedTableFromColumnsType(await inspectXor(state, columns, correlationId));
}

function definedTableFromColumnsType(columnsType: Type.TPowerQueryType): Type.Table | Type.DefinedTable {
    if (columnsType.extendedKind === Type.ExtendedTypeKind.TableType) {
        return TypeUtils.definedTable(false, new PQP.OrderedMap(columnsType.fields), columnsType.isOpen);
    }

    if (columnsType.extendedKind !== Type.ExtendedTypeKind.DefinedList) {
        return Type.TableInstance;
    }

    const fields: Map<string, Type.TPowerQueryType> = new Map();

    for (const element of columnsType.elements) {
        if (element.extendedKind !== Type.ExtendedTypeKind.TextLiteral) {
            return Type.TableInstance;
        }

        // Convert the quoted M text literal to its unescaped column name.
        const fieldName: string = TextUtils.unescape(element.literal.slice(1, -1));

        if (fields.has(fieldName)) {
            return Type.TableInstance;
        }

        fields.set(fieldName, Type.AnyInstance);
    }

    return TypeUtils.definedTable(false, new PQP.OrderedMap(fields), false);
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { ArrayUtils } from "@microsoft/powerquery-parser";
import { FieldSpecificationKeyValuePair } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser/nodeIdMap/nodeIdMapIterator";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectTypeFieldSpecification } from "./inspectTypeFieldSpecification";
import { InspectTypeState } from "./common";

export interface ExaminedFieldSpecificationList {
    readonly fields: Map<string, Type.TPowerQueryType>;
    readonly isOpen: boolean;
}

// It's called an examination instead of inspection because it doesn't return TType.
export async function examineFieldSpecificationList(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<ExaminedFieldSpecificationList> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        examineFieldSpecificationList.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FieldSpecificationList>(xorNode, Ast.NodeKind.FieldSpecificationList);

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    const fields: ReadonlyArray<[string, Type.TPowerQueryType]> = await ArrayUtils.mapAsync(
        NodeIdMapIterator.iterFieldSpecificationList(nodeIdMapCollection, xorNode),
        async (fieldSpecification: FieldSpecificationKeyValuePair) => [
            fieldSpecification.normalizedKeyLiteral,
            await inspectTypeFieldSpecification(state, fieldSpecification.source, trace.id),
        ],
    );

    const isOpen: boolean =
        NodeIdMapUtils.nthChildChecked(nodeIdMapCollection, xorNode.node.id, 3, Ast.NodeKind.Constant) !== undefined;

    const result: ExaminedFieldSpecificationList = {
        fields: new Map(fields),
        isOpen,
    };

    trace.exit();

    return result;
}

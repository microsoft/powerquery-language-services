// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, AstUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";

import { assertGetOrCreateNodeScope, NodeScope, ScopeById, ScopeItemKind, TScopeItem } from "../scope";
import {
    DereferencedIdentifierExternal,
    DereferencedIdentifierKind,
    DereferencedIdentifierUndefined,
    TDereferencedIdentifier,
} from "././dereferencedIdentifier";
import { ExternalTypeUtils, Inspection, InspectionSettings, TraceUtils } from "../..";
import { InspectionTraceConstant } from "../../trace";
import { TypeById } from "../typeCache";

// Recursively dereference the identifier until it reaches either:
// - A value node
// - An external type
// - Undefined
export async function tryBuildDereferencedIdentifierPath(
    inspectionSettings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    eachScopeById: TypeById | undefined,
    xorNode: TXorNode,
    // If a map is given, then it's mutated and returned.
    // Else create a new Map instance and return that instead.
    scopeById: ScopeById = new Map(),
): Promise<PQP.Result<ReadonlyArray<TDereferencedIdentifier>, PQP.CommonError.CommonError>> {
    try {
        return await recursiveDereferenceIdentifier(
            inspectionSettings,
            nodeIdMapCollection,
            eachScopeById,
            xorNode,
            scopeById,
            [],
        );
    } catch (caught: unknown) {
        Assert.isInstanceofError(caught);

        return ResultUtils.error(PQP.CommonError.ensureCommonError(caught, inspectionSettings.locale));
    }
}

// Builds up the `path` argument as it recursively dereferences the xorNode identifier.
async function recursiveDereferenceIdentifier(
    inspectionSettings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    eachScopeById: TypeById | undefined,
    xorNode: TXorNode,
    scopeById: ScopeById,
    path: TDereferencedIdentifier[],
): Promise<PQP.Result<TDereferencedIdentifier[], PQP.CommonError.CommonError>> {
    const trace: Trace = inspectionSettings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        recursiveDereferenceIdentifier.name,
        inspectionSettings.initialCorrelationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    const updatedSettings: InspectionSettings = {
        ...inspectionSettings,
        initialCorrelationId: trace.id,
    };

    XorNodeUtils.assertIsIdentifier(xorNode);

    if (XorNodeUtils.isContext(xorNode)) {
        trace.exit({ [TraceConstant.IsThrowing]: true });

        throw new PQP.CommonError.InvariantError(`expected xorNode to be an identifier`, { xorNode });
    }

    const identifier: Ast.Identifier | Ast.IdentifierExpression = xorNode.node;
    const identifierLiteral: string = AstUtils.getIdentifierLiteral(identifier);

    // eslint-disable-next-line no-await-in-loop
    const triedNodeScope: Inspection.TriedNodeScope = await assertGetOrCreateNodeScope(
        updatedSettings,
        nodeIdMapCollection,
        eachScopeById,
        xorNode.node.id,
        scopeById,
    );

    if (ResultUtils.isError(triedNodeScope)) {
        trace.exit({ [TraceConstant.Result]: triedNodeScope.kind });

        return triedNodeScope;
    }

    const nodeScope: NodeScope = triedNodeScope.value;
    const scopeItem: TScopeItem | undefined = nodeScope.get(identifierLiteral);

    if (scopeItem === undefined) {
        const finalPath: TDereferencedIdentifier = onIdentifierNotInScope(updatedSettings, identifierLiteral);
        path.push(finalPath);

        trace.exit();

        return ResultUtils.ok(path);
    }

    // See if there's another scope item that needs to be dereferenced as well.
    let nextXorNode: TXorNode | undefined;

    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
        case ScopeItemKind.Parameter:
        case ScopeItemKind.Undefined:
            break;

        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            path.push({
                kind: DereferencedIdentifierKind.InScope,
                identifierLiteral,
                nextScopeItem: scopeItem,
            });

            nextXorNode = scopeItem.value;
            break;

        default:
            throw Assert.isNever(scopeItem);
    }

    // There's another scope item to dereference.
    if (nextXorNode) {
        const result: PQP.Result<TDereferencedIdentifier[], PQP.CommonError.CommonError> =
            await recursiveDereferenceIdentifier(
                updatedSettings,
                nodeIdMapCollection,
                eachScopeById,
                nextXorNode,
                scopeById,
                path,
            );

        trace.exit();

        return result;
    }

    // No more scope items to dereference, we're at a value node.
    path.push({
        kind: DereferencedIdentifierKind.InScopeValue,
        identifierLiteral,
        xorNode,
    });

    trace.exit();

    return ResultUtils.ok(path);
}

function onIdentifierNotInScope(
    inspectionSettings: InspectionSettings,
    identifierLiteral: string,
): DereferencedIdentifierExternal | DereferencedIdentifierUndefined {
    const externalType: TPowerQueryType | undefined = inspectionSettings.library.externalTypeResolver(
        ExternalTypeUtils.valueTypeRequest(identifierLiteral),
    );

    return externalType
        ? {
              kind: DereferencedIdentifierKind.External,
              identifierLiteral,
              type: externalType,
          }
        : {
              kind: DereferencedIdentifierKind.Undefined,
              identifierLiteral,
          };
}

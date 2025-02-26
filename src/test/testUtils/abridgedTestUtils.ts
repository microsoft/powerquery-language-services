// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "@microsoft/powerquery-parser";
import { Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { DocumentSymbol, Inspection, SignatureHelp, SymbolKind } from "../../powerquery-language-services";
import { NodeScope } from "../../powerquery-language-services/inspection";

export interface AbridgedDocumentSymbol {
    readonly name: string;
    readonly kind: SymbolKind;
    readonly children?: ReadonlyArray<AbridgedDocumentSymbol>;
}

export type TAbridgedNodeScopeItem =
    | AbridgedEachScopeItem
    | AbridgedLetVariableScopeItem
    | AbridgedParameterScopeItem
    | AbridgedRecordScopeItem
    | AbridgedSectionMemberScopeItem
    | AbridgedUndefinedScopeItem;

export type AbridgedSignatureHelp = Pick<SignatureHelp, "activeSignature" | "activeParameter">;

export interface IAbridgedNodeScopeItem {
    readonly identifier: string;
    readonly isRecursive: boolean;
    readonly kind: Inspection.ScopeItemKind;
}

export interface AbridgedEachScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.Each;
    readonly eachExpressionNodeId: number;
}

export interface AbridgedLetVariableScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.LetVariable;
    readonly keyNodeId: number;
    readonly valueNodeId: number | undefined;
}

export interface AbridgedParameterScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.Parameter;
    readonly isNullable: boolean;
    readonly isOptional: boolean;
    readonly type: Constant.PrimitiveTypeConstant | undefined;
}

export interface AbridgedRecordScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.RecordField;
    readonly keyNodeId: number;
    readonly valueNodeId: number | undefined;
}

export interface AbridgedSectionMemberScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.SectionMember;
    readonly keyNodeId: number;
    readonly valueNodeId: number | undefined;
}

export interface AbridgedUndefinedScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.Undefined;
    readonly nodeId: number;
}

export function abridgedDocumentSymbols(
    documentSymbols: ReadonlyArray<DocumentSymbol>,
): ReadonlyArray<AbridgedDocumentSymbol> {
    return documentSymbols.map((documentSymbol: DocumentSymbol) => {
        if (documentSymbol.children !== undefined && documentSymbol.children.length > 0) {
            return {
                name: documentSymbol.name,
                kind: documentSymbol.kind,
                children: abridgedDocumentSymbols(documentSymbol.children),
            };
        } else {
            return {
                name: documentSymbol.name,
                kind: documentSymbol.kind,
            };
        }
    });
}

export function abridgedNodeScopeItems(nodeScope: NodeScope): ReadonlyArray<TAbridgedNodeScopeItem> {
    const result: TAbridgedNodeScopeItem[] = [];

    for (const [identifier, scopeItem] of nodeScope) {
        switch (scopeItem.kind) {
            case Inspection.ScopeItemKind.LetVariable:
            case Inspection.ScopeItemKind.RecordField:
            case Inspection.ScopeItemKind.SectionMember:
                result.push({
                    identifier,
                    isRecursive: scopeItem.isRecursive,
                    kind: scopeItem.kind,
                    keyNodeId: scopeItem.key.id,
                    valueNodeId: scopeItem.value?.node.id,
                });

                break;

            case Inspection.ScopeItemKind.Each:
                result.push({
                    identifier,
                    isRecursive: scopeItem.isRecursive,
                    kind: scopeItem.kind,
                    eachExpressionNodeId: scopeItem.eachExpression.node.id,
                });

                break;

            case Inspection.ScopeItemKind.Parameter:
                result.push({
                    identifier,
                    isRecursive: scopeItem.isRecursive,
                    kind: scopeItem.kind,
                    isNullable: scopeItem.isNullable,
                    isOptional: scopeItem.isOptional,
                    type: scopeItem.type,
                });

                break;

            case Inspection.ScopeItemKind.Undefined:
                result.push({
                    identifier,
                    isRecursive: scopeItem.isRecursive,
                    kind: scopeItem.kind,
                    nodeId: scopeItem.xorNode.node.id,
                });

                break;

            default:
                throw Assert.isNever(scopeItem);
        }
    }

    return result;
}

export function abridgedSignatureHelp(value: SignatureHelp): AbridgedSignatureHelp {
    return {
        activeParameter: value.activeParameter,
        activeSignature: value.activeSignature,
    };
}

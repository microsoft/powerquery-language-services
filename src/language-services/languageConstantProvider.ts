// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { CompletionItem, CompletionItemKind } from "./commonTypes";
import { CompletionItemProvider, CompletionItemProviderContext } from "./providers";

export class LanguageConstantProvider implements CompletionItemProvider {
    // Power Query defines constructor functions (ex. #table()) as keywords, but we want
    // them to be treated like library functions instead.
    private static readonly ExcludedKeywords: ReadonlyArray<PQP.Language.KeywordKind> = [
        PQP.Language.KeywordKind.HashBinary,
        PQP.Language.KeywordKind.HashDate,
        PQP.Language.KeywordKind.HashDateTime,
        PQP.Language.KeywordKind.HashDateTimeZone,
        PQP.Language.KeywordKind.HashDuration,
        PQP.Language.KeywordKind.HashInfinity,
        PQP.Language.KeywordKind.HashNan,
        PQP.Language.KeywordKind.HashSections,
        PQP.Language.KeywordKind.HashShared,
        PQP.Language.KeywordKind.HashTable,
        PQP.Language.KeywordKind.HashTime,
    ];

    private static readonly LanguageConstants: ReadonlyArray<CompletionItem> = [
        { kind: CompletionItemKind.Keyword, label: PQP.Language.Ast.IdentifierConstantKind.Nullable },
        { kind: CompletionItemKind.Keyword, label: PQP.Language.Ast.IdentifierConstantKind.Optional },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Action },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Any },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.AnyNonNull },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Binary },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Date },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.DateTime },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.DateTimeZone },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Duration },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Function },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.List },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Logical },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.None },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Null },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Number },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Record },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Table },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Text },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Time },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Ast.PrimitiveTypeConstantKind.Type },
    ];

    constructor(private readonly maybeTriedInspection: PQP.Task.TriedInspection | undefined) {}

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        return [...LanguageConstantProvider.LanguageConstants, ...this.getKeywords()];
    }

    private getKeywords(): CompletionItem[] {
        if (this.maybeTriedInspection === undefined || PQP.ResultUtils.isErr(this.maybeTriedInspection)) {
            return [];
        }
        const inspectionOk: PQP.Task.InspectionOk = this.maybeTriedInspection.value;

        return inspectionOk.autocomplete
            .filter(
                (keyword: PQP.Language.KeywordKind) =>
                    LanguageConstantProvider.ExcludedKeywords.indexOf(keyword) === -1,
            )
            .map((keyword: PQP.Language.KeywordKind) => {
                return {
                    kind: CompletionItemKind.Keyword,
                    label: keyword,
                };
            });
    }
}

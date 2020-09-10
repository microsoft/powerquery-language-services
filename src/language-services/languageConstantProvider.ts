// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { CompletionItem, CompletionItemKind } from "./commonTypes";
import { CompletionItemProvider, CompletionItemProviderContext } from "./providers";

export class LanguageConstantProvider implements CompletionItemProvider {
    // Power Query defines constructor functions (ex. #table()) as keywords, but we want
    // them to be treated like library functions instead.
    private static readonly ExcludedKeywords: ReadonlyArray<PQP.Language.Keyword.KeywordKind> = [
        PQP.Language.Keyword.KeywordKind.HashBinary,
        PQP.Language.Keyword.KeywordKind.HashDate,
        PQP.Language.Keyword.KeywordKind.HashDateTime,
        PQP.Language.Keyword.KeywordKind.HashDateTimeZone,
        PQP.Language.Keyword.KeywordKind.HashDuration,
        PQP.Language.Keyword.KeywordKind.HashInfinity,
        PQP.Language.Keyword.KeywordKind.HashNan,
        PQP.Language.Keyword.KeywordKind.HashSections,
        PQP.Language.Keyword.KeywordKind.HashShared,
        PQP.Language.Keyword.KeywordKind.HashTable,
        PQP.Language.Keyword.KeywordKind.HashTime,
    ];

    private static readonly LanguageConstants: ReadonlyArray<CompletionItem> = [
        { kind: CompletionItemKind.Keyword, label: PQP.Language.Constant.IdentifierConstantKind.Nullable },
        { kind: CompletionItemKind.Keyword, label: PQP.Language.Constant.IdentifierConstantKind.Optional },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Action },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Any },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.AnyNonNull },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Binary },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Date },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.DateTime },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.DateTimeZone },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Duration },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Function },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.List },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Logical },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.None },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Null },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Number },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Record },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Table },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Text },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Time },
        { kind: CompletionItemKind.TypeParameter, label: PQP.Language.Constant.PrimitiveTypeConstantKind.Type },
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
                // TODO: next parser update should include `PQP.Language.KeywordUtils.isKeyword`.
                (option: PQP.Inspection.AutocompleteOption) => {
                    if (PQP.Language.Keyword.KeywordKinds.includes(option as PQP.Language.Keyword.KeywordKind)) {
                        return !LanguageConstantProvider.ExcludedKeywords.includes(
                            option as PQP.Language.Keyword.KeywordKind,
                        );
                    } else {
                        return true;
                    }
                },
            )
            .map((option: PQP.Inspection.AutocompleteOption) => {
                return {
                    kind: CompletionItemKind.Keyword,
                    label: option,
                };
            });
    }
}

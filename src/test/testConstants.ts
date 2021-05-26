// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import {
    AnalysisSettings,
    CompletionItemKind,
    Inspection,
    InspectionSettings,
    Library,
    LibraryUtils,
    LocalDocumentSymbolProvider,
    ValidationSettings,
    WorkspaceCache,
} from "../powerquery-language-services";
import { LibrarySymbolProvider } from "../powerquery-language-services/providers/librarySymbolProvider";

export const DefaultInspectionSettings: InspectionSettings = {
    ...PQP.DefaultSettings,
    maybeExternalTypeResolver: undefined,
};

export const NoOpLibrary: Library.ILibrary = {
    externalTypeResolver: Inspection.ExternalType.noOpExternalTypeResolver,
    libraryDefinitions: new Map(),
};

export const CreateFooAndBarRecordDefinedFunction: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.createDefinedFunction(
    false,
    [],
    PQP.Language.TypeUtils.createDefinedRecord(
        false,
        new Map<string, PQP.Language.Type.TPowerQueryType>([
            ["foo", PQP.Language.TypeUtils.createTextLiteral(false, `"fooString"`)],
            ["bar", PQP.Language.TypeUtils.createTextLiteral(false, `"barString"`)],
        ]),
        false,
    ),
);

export const CombineNumberAndOptionalTextDefinedFunction: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.createDefinedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            nameLiteral: "firstArg",
            maybeType: PQP.Language.Type.TypeKind.Number,
        },
        {
            isNullable: false,
            isOptional: true,
            nameLiteral: "secondArg",
            maybeType: PQP.Language.Type.TypeKind.Text,
        },
    ],
    PQP.Language.Type.NullInstance,
);

export const SquareIfNumberDefinedFunction: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.createDefinedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            maybeType: undefined,
            nameLiteral: "x",
        },
    ],
    PQP.Language.Type.AnyInstance,
);

export const DuplicateTextDefinedFunction: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.createDefinedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            maybeType: PQP.Language.Type.TypeKind.Text,
            nameLiteral: "txt",
        },
    ],
    PQP.Language.Type.TextInstance,
);

export const SimpleLibraryDefinitions: Library.LibraryDefinitions = new Map<string, Library.TLibraryDefinition>([
    [
        TestLibraryName.CreateFooAndBarRecord,
        LibraryUtils.createFunctionDefinition(
            TestLibraryName.CreateFooAndBarRecord,
            `The name is ${TestLibraryName.CreateFooAndBarRecord}`,
            CreateFooAndBarRecordDefinedFunction,
            CompletionItemKind.Function,
            [],
        ),
    ],
    [
        TestLibraryName.Number,
        LibraryUtils.createConstantDefinition(
            TestLibraryName.Number,
            `The name is ${TestLibraryName.Number}`,
            PQP.Language.Type.NumberInstance,
            CompletionItemKind.Value,
        ),
    ],
    [
        TestLibraryName.CombineNumberAndOptionalText,
        LibraryUtils.createFunctionDefinition(
            TestLibraryName.CombineNumberAndOptionalText,
            `The name is ${TestLibraryName.CombineNumberAndOptionalText}`,
            CombineNumberAndOptionalTextDefinedFunction,
            CompletionItemKind.Function,
            [
                {
                    isNullable: false,
                    isOptional: false,
                    label: "firstArg",
                    maybeDocumentation: undefined,
                    typeKind: PQP.Language.Type.TypeKind.Number,
                },
                {
                    isNullable: false,
                    isOptional: true,
                    label: "secondArg",
                    maybeDocumentation: undefined,
                    typeKind: PQP.Language.Type.TypeKind.Text,
                },
            ],
        ),
    ],
    [
        TestLibraryName.NumberOne,
        LibraryUtils.createConstantDefinition(
            TestLibraryName.NumberOne,
            `The name is ${TestLibraryName.NumberOne}`,
            PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
            CompletionItemKind.Constant,
        ),
    ],
    [
        TestLibraryName.SquareIfNumber,
        LibraryUtils.createFunctionDefinition(
            TestLibraryName.SquareIfNumber,
            `The name is ${TestLibraryName.SquareIfNumber}`,
            SquareIfNumberDefinedFunction,
            CompletionItemKind.Function,
            [
                {
                    isNullable: false,
                    isOptional: false,
                    label: "x",
                    maybeDocumentation:
                        "If the argument is a number then multiply it by itself, otherwise return argument as-is.",
                    typeKind: PQP.Language.Type.TypeKind.Any,
                },
            ],
        ),
    ],
]);

export const SimpleExternalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn = (
    request: Inspection.ExternalType.TExternalTypeRequest,
) => {
    switch (request.kind) {
        case Inspection.ExternalType.ExternalTypeRequestKind.Invocation:
            switch (request.identifierLiteral) {
                case TestLibraryName.SquareIfNumber: {
                    if (request.args.length !== 1) {
                        return PQP.Language.Type.NoneInstance;
                    }
                    const arg: PQP.Language.Type.TPowerQueryType = Assert.asDefined(request.args[0]);

                    if (PQP.Language.TypeUtils.isNumberLiteral(arg)) {
                        const newNormalizedLiteral: number = arg.normalizedLiteral * arg.normalizedLiteral;
                        return {
                            ...arg,
                            literal: newNormalizedLiteral.toString(),
                            normalizedLiteral: newNormalizedLiteral,
                        };
                    } else if (PQP.Language.TypeUtils.isNumber(arg)) {
                        return PQP.Language.Type.NumberInstance;
                    } else {
                        return PQP.Language.Type.AnyInstance;
                    }
                }

                default:
                    return undefined;
            }

        case Inspection.ExternalType.ExternalTypeRequestKind.Value:
            switch (request.identifierLiteral) {
                case TestLibraryName.CreateFooAndBarRecord:
                    return CreateFooAndBarRecordDefinedFunction;

                case TestLibraryName.CombineNumberAndOptionalText:
                    return CombineNumberAndOptionalTextDefinedFunction;

                case TestLibraryName.DuplicateText:
                    return DuplicateTextDefinedFunction;

                case TestLibraryName.Number:
                    return PQP.Language.Type.NumberInstance;

                case TestLibraryName.NumberOne:
                    return PQP.Language.TypeUtils.createNumberLiteral(false, "1");

                case TestLibraryName.SquareIfNumber:
                    return SquareIfNumberDefinedFunction;

                default:
                    return undefined;
            }

        default:
            throw Assert.isNever(request);
    }
};

export const SimpleInspectionSettings: InspectionSettings = {
    ...DefaultInspectionSettings,
    maybeExternalTypeResolver: SimpleExternalTypeResolver,
};

export const SimpleValidationSettings: ValidationSettings = {
    ...SimpleInspectionSettings,
    checkForDuplicateIdentifiers: true,
    source: "UNIT-TEST-SOURCE",
};

export const SimpleLibrary: Library.ILibrary = {
    externalTypeResolver: SimpleExternalTypeResolver,
    libraryDefinitions: SimpleLibraryDefinitions,
};

export const SimpleLibraryAnalysisSettings: AnalysisSettings = {
    createInspectionSettingsFn: () => SimpleInspectionSettings,
    library: SimpleLibrary,
    maybeCreateLibrarySymbolProviderFn: (library: Library.ILibrary) => new LibrarySymbolProvider(library),
    maybeCreateLocalDocumentSymbolProviderFn: (
        library: Library.ILibrary,
        maybeTriedInspection: WorkspaceCache.InspectionCacheItem | undefined,
    ) => new LocalDocumentSymbolProvider(library, maybeTriedInspection),
};

export const enum TestLibraryName {
    CreateFooAndBarRecord = "Test.CreateFooAndBarRecord",
    CombineNumberAndOptionalText = "Test.CombineNumberAndOptionalText",
    DuplicateText = "Test.DuplicateText",
    Number = "Test.Number",
    NumberOne = "Test.NumberOne",
    SquareIfNumber = "Test.SquareIfNumber",
}

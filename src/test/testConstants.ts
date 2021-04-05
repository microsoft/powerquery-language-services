// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import {
    AnalysisOptions,
    Inspection,
    Library,
    LibraryUtils,
    LocalDocumentSymbolProvider,
    WorkspaceCache,
} from "../powerquery-language-services";
import { LibrarySymbolProvider } from "../powerquery-language-services/providers/librarySymbolProvider";

export const DefaultSettings: PQP.Settings & Inspection.InspectionSettings = {
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
        new Map<string, PQP.Language.Type.PowerQueryType>([
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
            CreateFooAndBarRecordDefinedFunction,
            `The name is ${TestLibraryName.CreateFooAndBarRecord}`,
            TestLibraryName.CreateFooAndBarRecord,
            PQP.Language.Type.RecordInstance,
            [],
        ),
    ],
    [
        TestLibraryName.Number,
        LibraryUtils.createConstantDefinition(
            PQP.Language.Type.NumberInstance,
            `The name is ${TestLibraryName.Number}`,
            TestLibraryName.Number,
            PQP.Language.Type.NumberInstance,
        ),
    ],
    [
        TestLibraryName.CombineNumberAndOptionalText,
        LibraryUtils.createFunctionDefinition(
            CombineNumberAndOptionalTextDefinedFunction,
            `The name is ${TestLibraryName.CombineNumberAndOptionalText}`,
            TestLibraryName.CombineNumberAndOptionalText,
            PQP.Language.Type.NullInstance,
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
            PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
            `The name is ${TestLibraryName.NumberOne}`,
            TestLibraryName.NumberOne,
            PQP.Language.Type.NumberInstance,
        ),
    ],
    [
        TestLibraryName.SquareIfNumber,
        LibraryUtils.createFunctionDefinition(
            SquareIfNumberDefinedFunction,
            `The name is ${TestLibraryName.SquareIfNumber}`,
            TestLibraryName.SquareIfNumber,
            PQP.Language.Type.AnyInstance,
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
                    const arg: PQP.Language.Type.PowerQueryType = Assert.asDefined(request.args[0]);

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

export const SimpleSettings: PQP.Settings & Inspection.InspectionSettings = {
    ...DefaultSettings,
    maybeExternalTypeResolver: SimpleExternalTypeResolver,
};

export const SimpleLibrary: Library.ILibrary = {
    externalTypeResolver: SimpleExternalTypeResolver,
    libraryDefinitions: SimpleLibraryDefinitions,
};

export const SimpleLibraryAnalysisOptions: AnalysisOptions = {
    createLibrarySymbolProviderFn: (library: Library.ILibrary) => new LibrarySymbolProvider(library),
    createLocalDocumentSymbolProviderFn: (
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

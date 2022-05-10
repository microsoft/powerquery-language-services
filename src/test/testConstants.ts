// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
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
} from "../powerquery-language-services";
import { LibrarySymbolProvider } from "../powerquery-language-services/providers/librarySymbolProvider";

export const DefaultInspectionSettings: InspectionSettings = {
    ...PQP.DefaultSettings,
    isWorkspaceCacheAllowed: false,
    maybeEachScopeById: undefined,
    maybeExternalTypeResolver: undefined,
};

export const NoOpLibrary: Library.ILibrary = {
    externalTypeResolver: Inspection.ExternalType.noOpExternalTypeResolver,
    libraryDefinitions: new Map(),
};

export const CreateFooAndBarRecordDefinedFunction: Type.DefinedFunction = TypeUtils.createDefinedFunction(
    false,
    [],
    TypeUtils.createDefinedRecord(
        false,
        new Map<string, Type.TPowerQueryType>([
            ["foo", TypeUtils.createTextLiteral(false, `"fooString"`)],
            ["bar", TypeUtils.createTextLiteral(false, `"barString"`)],
        ]),
        false,
    ),
);

export const CombineNumberAndOptionalTextDefinedFunction: Type.DefinedFunction = TypeUtils.createDefinedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            nameLiteral: "firstArg",
            maybeType: Type.TypeKind.Number,
        },
        {
            isNullable: false,
            isOptional: true,
            nameLiteral: "secondArg",
            maybeType: Type.TypeKind.Text,
        },
    ],
    Type.NullInstance,
);

export const SquareIfNumberDefinedFunction: Type.DefinedFunction = TypeUtils.createDefinedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            maybeType: undefined,
            nameLiteral: "x",
        },
    ],
    Type.AnyInstance,
);

export const DuplicateTextDefinedFunction: Type.DefinedFunction = TypeUtils.createDefinedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            maybeType: Type.TypeKind.Text,
            nameLiteral: "txt",
        },
    ],
    Type.TextInstance,
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
            Type.NumberInstance,
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
                    typeKind: Type.TypeKind.Number,
                },
                {
                    isNullable: false,
                    isOptional: true,
                    label: "secondArg",
                    maybeDocumentation: undefined,
                    typeKind: Type.TypeKind.Text,
                },
            ],
        ),
    ],
    [
        TestLibraryName.NumberOne,
        LibraryUtils.createConstantDefinition(
            TestLibraryName.NumberOne,
            `The name is ${TestLibraryName.NumberOne}`,
            TypeUtils.createNumberLiteral(false, "1"),
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
                    typeKind: Type.TypeKind.Any,
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
                        return Type.NoneInstance;
                    }

                    const arg: Type.TPowerQueryType = Assert.asDefined(request.args[0]);

                    if (TypeUtils.isNumberLiteral(arg)) {
                        const newNormalizedLiteral: number = arg.normalizedLiteral * arg.normalizedLiteral;

                        return {
                            ...arg,
                            literal: newNormalizedLiteral.toString(),
                            normalizedLiteral: newNormalizedLiteral,
                        };
                    } else if (TypeUtils.isNumber(arg)) {
                        return Type.NumberInstance;
                    } else {
                        return Type.AnyInstance;
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
                    return Type.NumberInstance;

                case TestLibraryName.NumberOne:
                    return TypeUtils.createNumberLiteral(false, "1");

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
    checkInvokeExpressions: true,
    source: "UNIT-TEST-SOURCE",
};

export const SimpleLibrary: Library.ILibrary = {
    externalTypeResolver: SimpleExternalTypeResolver,
    libraryDefinitions: SimpleLibraryDefinitions,
};

export const SimpleLibraryAnalysisSettings: AnalysisSettings = {
    createInspectionSettingsFn: () => SimpleInspectionSettings,
    isWorkspaceCacheAllowed: false,
    library: SimpleLibrary,
    maybeCreateLibrarySymbolProviderFn: (library: Library.ILibrary) => new LibrarySymbolProvider(library),
    maybeCreateLocalDocumentSymbolProviderFn: (
        library: Library.ILibrary,
        maybePromiseInspection: Promise<Inspection.Inspected | undefined>,
        createInspectionSettingsFn: () => InspectionSettings,
    ) => new LocalDocumentSymbolProvider(library, maybePromiseInspection, createInspectionSettingsFn),
};

export const enum TestLibraryName {
    CreateFooAndBarRecord = "Test.CreateFooAndBarRecord",
    CombineNumberAndOptionalText = "Test.CombineNumberAndOptionalText",
    DuplicateText = "Test.DuplicateText",
    Number = "Test.Number",
    NumberOne = "Test.NumberOne",
    SquareIfNumber = "Test.SquareIfNumber",
}

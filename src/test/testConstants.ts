// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as StandardLibrarySymbolsEnUs from "./standard-library-symbols-en-us.json";
import { Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Assert } from "@microsoft/powerquery-parser";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import {
    AnalysisSettings,
    CompletionItemKind,
    ExternalType,
    InspectionSettings,
    Library,
    LibraryDefinitionUtils,
    LibrarySymbolUtils,
    TypeStrategy,
    ValidationSettings,
} from "../powerquery-language-services";

export enum TestLibraryName {
    CombineNumberAndOptionalText = "Test.CombineNumberAndOptionalText",
    CreateFooAndBarRecord = "Test.CreateFooAndBarRecord",
    DuplicateText = "Test.DuplicateText",
    DynamicFunction = "Test.DynamicFunction",
    DynamicValue = "Test.DynamicValue",
    Number = "Test.Number",
    NumberOne = "Test.NumberOne",
    SquareIfNumber = "Test.SquareIfNumber",
}

export const DefaultInspectionSettings: InspectionSettings = {
    ...PQP.DefaultSettings,
    isWorkspaceCacheAllowed: false,
    library: Library.NoOpLibrary,
    eachScopeById: undefined,
    typeStrategy: TypeStrategy.Extended,
};

export const CreateFooAndBarRecordDefinedFunction: Type.DefinedFunction = TypeUtils.definedFunction(
    false,
    [],
    TypeUtils.definedRecord(
        false,
        new Map<string, Type.TPowerQueryType>([
            ["foo", TypeUtils.textLiteral(false, `"fooString"`)],
            ["bar", TypeUtils.textLiteral(false, `"barString"`)],
        ]),
        false,
    ),
);

export const CombineNumberAndOptionalTextDefinedFunction: Type.DefinedFunction = TypeUtils.definedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            nameLiteral: "firstArg",
            type: Type.TypeKind.Number,
        },
        {
            isNullable: false,
            isOptional: true,
            nameLiteral: "secondArg",
            type: Type.TypeKind.Text,
        },
    ],
    Type.NullInstance,
);

export const SquareIfNumberDefinedFunction: Type.DefinedFunction = TypeUtils.definedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            type: undefined,
            nameLiteral: "x",
        },
    ],
    Type.AnyInstance,
);

export const DuplicateTextDefinedFunction: Type.DefinedFunction = TypeUtils.definedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            type: Type.TypeKind.Text,
            nameLiteral: "txt",
        },
    ],
    Type.TextInstance,
);

export const SimpleLibraryDefinitions: Library.LibraryDefinitions = {
    dynamicLibraryDefinitions: () =>
        new Map<string, Library.TLibraryDefinition>([
            [
                TestLibraryName.DynamicFunction,
                LibraryDefinitionUtils.functionDefinition(
                    TestLibraryName.DynamicFunction,
                    `The name is ${TestLibraryName.DynamicFunction}`,
                    TypeUtils.definedFunction(false, [], Type.AnyInstance),
                    CompletionItemKind.Function,
                    [],
                ),
            ],
            [
                TestLibraryName.DynamicValue,
                LibraryDefinitionUtils.constantDefinition(
                    TestLibraryName.DynamicValue,
                    `The name is ${TestLibraryName.DynamicValue}`,
                    Type.AnyInstance,
                    CompletionItemKind.Value,
                ),
            ],
        ]),
    staticLibraryDefinitions: new Map<string, Library.TLibraryDefinition>([
        [
            TestLibraryName.CreateFooAndBarRecord,
            LibraryDefinitionUtils.functionDefinition(
                TestLibraryName.CreateFooAndBarRecord,
                `The name is ${TestLibraryName.CreateFooAndBarRecord}`,
                CreateFooAndBarRecordDefinedFunction,
                CompletionItemKind.Function,
                [],
            ),
        ],
        [
            TestLibraryName.Number,
            LibraryDefinitionUtils.constantDefinition(
                TestLibraryName.Number,
                `The name is ${TestLibraryName.Number}`,
                Type.NumberInstance,
                CompletionItemKind.Value,
            ),
        ],
        [
            TestLibraryName.CombineNumberAndOptionalText,
            LibraryDefinitionUtils.functionDefinition(
                TestLibraryName.CombineNumberAndOptionalText,
                `The name is ${TestLibraryName.CombineNumberAndOptionalText}`,
                CombineNumberAndOptionalTextDefinedFunction,
                CompletionItemKind.Function,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        label: "firstArg",
                        documentation: undefined,
                        typeKind: Type.TypeKind.Number,
                    },
                    {
                        isNullable: false,
                        isOptional: true,
                        label: "secondArg",
                        documentation: undefined,
                        typeKind: Type.TypeKind.Text,
                    },
                ],
            ),
        ],
        [
            TestLibraryName.NumberOne,
            LibraryDefinitionUtils.constantDefinition(
                TestLibraryName.NumberOne,
                `The name is ${TestLibraryName.NumberOne}`,
                TypeUtils.numberLiteral(false, "1"),
                CompletionItemKind.Constant,
            ),
        ],
        [
            TestLibraryName.SquareIfNumber,
            LibraryDefinitionUtils.functionDefinition(
                TestLibraryName.SquareIfNumber,
                `The name is ${TestLibraryName.SquareIfNumber}`,
                SquareIfNumberDefinedFunction,
                CompletionItemKind.Function,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        label: "x",
                        documentation:
                            "If the argument is a number then multiply it by itself, otherwise return argument as-is.",
                        typeKind: Type.TypeKind.Any,
                    },
                ],
            ),
        ],
    ]),
};

export const StandardLibraryDefinitions: Library.LibraryDefinitions = {
    dynamicLibraryDefinitions: () => new Map<string, Library.TLibraryDefinition>(),
    staticLibraryDefinitions: PQP.ResultUtils.assertOk(
        LibrarySymbolUtils.createLibraryDefinitions(StandardLibrarySymbolsEnUs),
    ),
};

export const SimpleExternalTypeResolver: ExternalType.TExternalTypeResolverFn = (
    request: ExternalType.TExternalTypeRequest,
) => {
    switch (request.kind) {
        case ExternalType.ExternalTypeRequestKind.Invocation:
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

        case ExternalType.ExternalTypeRequestKind.Value:
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
                    return TypeUtils.numberLiteral(false, "1");

                case TestLibraryName.SquareIfNumber:
                    return SquareIfNumberDefinedFunction;

                default:
                    return undefined;
            }

        default:
            throw Assert.isNever(request);
    }
};

export const SimpleLibrary: Library.ILibrary = {
    externalTypeResolver: SimpleExternalTypeResolver,
    libraryDefinitions: SimpleLibraryDefinitions,
};

export const StandardLibrary: Library.ILibrary = PQP.ResultUtils.assertOk(
    LibrarySymbolUtils.createLibrary(
        StandardLibrarySymbolsEnUs,
        () => new Map<string, Library.TLibraryDefinition>(),
        undefined,
    ),
);

export const EmptyLibrary: Library.ILibrary = {
    externalTypeResolver: (_request: ExternalType.TExternalTypeRequest) => undefined,
    libraryDefinitions: {
        dynamicLibraryDefinitions: () => new Map<string, Library.TLibraryDefinition>(),
        staticLibraryDefinitions: new Map<string, Library.TLibraryDefinition>(),
    },
};

export const SimpleInspectionSettings: InspectionSettings = {
    ...DefaultInspectionSettings,
    library: SimpleLibrary,
};

export const SimpleLibraryAnalysisSettings: AnalysisSettings = {
    isWorkspaceCacheAllowed: false,
    initialCorrelationId: undefined,
    traceManager: NoOpTraceManagerInstance,
    inspectionSettings: SimpleInspectionSettings,
};

export const SimpleValidateAllSettings: ValidationSettings = {
    ...SimpleInspectionSettings,
    checkForDuplicateIdentifiers: true,
    checkInvokeExpressions: true,
    checkUnknownIdentifiers: true,
    library: SimpleLibrary,
    source: "UNIT-TEST-SOURCE",
};

export const SimpleValidateNoneSettings: ValidationSettings = {
    ...SimpleInspectionSettings,
    checkForDuplicateIdentifiers: false,
    checkInvokeExpressions: false,
    checkUnknownIdentifiers: false,
    library: SimpleLibrary,
    source: "UNIT-TEST-SOURCE",
};

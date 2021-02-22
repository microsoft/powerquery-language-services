// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import { Assert } from "@microsoft/powerquery-parser";
import { ExternalType, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    AnalysisOptions,
    Library,
    LibraryUtils,
    LocalDocumentSymbolProvider,
    WorkspaceCache,
} from "../powerquery-language-services";
import { ILibrary } from "../powerquery-language-services/library/library";
import { LibrarySymbolProvider } from "../powerquery-language-services/providers/librarySymbolProvider";

export const NoOpLibrary: Library.ILibrary = {
    externalTypeResolver: ExternalType.noOpExternalTypeResolver,
    libraryDefinitions: new Map(),
};

export const SimpleLibraryDefinitions: Library.LibraryDefinitions = new Map<string, Library.TLibraryDefinition>([
    [
        TestLibraryName.CreateFooAndBarRecord,
        LibraryUtils.createFunctionDefinition(
            Type.FunctionInstance,
            `The name is ${TestLibraryName.CreateFooAndBarRecord}`,
            TestLibraryName.CreateFooAndBarRecord,
            Type.RecordInstance,
            [],
        ),
    ],
    [
        TestLibraryName.Number,
        LibraryUtils.createConstantDefinition(
            Type.NumberInstance,
            `The name is ${TestLibraryName.Number}`,
            TestLibraryName.Number,
            Type.NumberInstance,
        ),
    ],
    [
        TestLibraryName.NumberOne,
        LibraryUtils.createConstantDefinition(
            TypeUtils.numberLiteralFactory(false, "1"),
            `The name is ${TestLibraryName.NumberOne}`,
            TestLibraryName.NumberOne,
            Type.NumberInstance,
        ),
    ],
    [
        TestLibraryName.SquareIfNumber,
        LibraryUtils.createFunctionDefinition(
            TypeUtils.definedFunctionFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Type.TypeKind.Any,
                        nameLiteral: "x",
                    },
                ],
                TypeUtils.anyUnionFactory([Type.NumberInstance, Type.AnyInstance]),
            ),
            `The name is ${TestLibraryName.SquareIfNumber}`,
            TestLibraryName.SquareIfNumber,
            Type.AnyInstance,
            [
                {
                    label: "x",
                    description:
                        "If the argument is a number then multiply it by itself, otehrwise return argument as-is.",
                    parameters: [
                        {
                            isNullable: false,
                            isOptional: false,
                            label: "x",
                            maybeDocumentation: undefined,
                            signatureLabelEnd: -1,
                            signatureLabelOffset: -1,
                            typeKind: Type.TypeKind.Any,
                        },
                    ],
                },
            ],
        ),
    ],
]);

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
                    const arg: Type.TType = Assert.asDefined(request.args[0]);

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
                    return TypeUtils.definedFunctionFactory(
                        false,
                        [],
                        TypeUtils.definedRecordFactory(
                            false,
                            new Map<string, Type.TType>([
                                ["foo", TypeUtils.textLiteralFactory(false, `"fooString"`)],
                                ["bar", TypeUtils.textLiteralFactory(false, `"barString"`)],
                            ]),
                            false,
                        ),
                    );

                case TestLibraryName.Number:
                    return Type.NumberInstance;

                case TestLibraryName.NumberOne:
                    return TypeUtils.numberLiteralFactory(false, "1");

                case TestLibraryName.SquareIfNumber:
                    return TypeUtils.definedFunctionFactory(
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

export const SimpleLibraryAnalysisOptions: AnalysisOptions = {
    createLibrarySymbolProviderFn: (library: ILibrary) => new LibrarySymbolProvider(library),
    createLocalDocumentSymbolProviderFn: (
        library: ILibrary,
        maybeTriedInspection: WorkspaceCache.TInspectionCacheItem | undefined,
    ) => new LocalDocumentSymbolProvider(library, maybeTriedInspection),
};

export const enum TestLibraryName {
    CreateFooAndBarRecord = "Test.CreateFooAndBarRecord",
    SquareIfNumber = "Test.SquareIfNumber",
    Number = "Test.Number",
    NumberOne = "Test.NumberOne",
}

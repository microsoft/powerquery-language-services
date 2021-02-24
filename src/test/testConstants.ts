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

export const SimpleLibraryDefinitions: Library.LibraryDefinitions = new Map<string, Library.TLibraryDefinition>([
    [
        TestLibraryName.CreateFooAndBarRecord,
        LibraryUtils.createFunctionDefinition(
            PQP.Language.Type.FunctionInstance,
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
        TestLibraryName.NumberOne,
        LibraryUtils.createConstantDefinition(
            PQP.Language.TypeUtils.numberLiteralFactory(false, "1"),
            `The name is ${TestLibraryName.NumberOne}`,
            TestLibraryName.NumberOne,
            PQP.Language.Type.NumberInstance,
        ),
    ],
    [
        TestLibraryName.SquareIfNumber,
        LibraryUtils.createFunctionDefinition(
            PQP.Language.TypeUtils.definedFunctionFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: PQP.Language.Type.TypeKind.Any,
                        nameLiteral: "x",
                    },
                ],
                PQP.Language.TypeUtils.anyUnionFactory([
                    PQP.Language.Type.NumberInstance,
                    PQP.Language.Type.AnyInstance,
                ]),
            ),
            `The name is ${TestLibraryName.SquareIfNumber}`,
            TestLibraryName.SquareIfNumber,
            PQP.Language.Type.AnyInstance,
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
                            typeKind: PQP.Language.Type.TypeKind.Any,
                        },
                    ],
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
                    const arg: PQP.Language.Type.TType = Assert.asDefined(request.args[0]);

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
                    return PQP.Language.TypeUtils.definedFunctionFactory(
                        false,
                        [],
                        PQP.Language.TypeUtils.definedRecordFactory(
                            false,
                            new Map<string, PQP.Language.Type.TType>([
                                ["foo", PQP.Language.TypeUtils.textLiteralFactory(false, `"fooString"`)],
                                ["bar", PQP.Language.TypeUtils.textLiteralFactory(false, `"barString"`)],
                            ]),
                            false,
                        ),
                    );

                case TestLibraryName.Number:
                    return PQP.Language.Type.NumberInstance;

                case TestLibraryName.NumberOne:
                    return PQP.Language.TypeUtils.numberLiteralFactory(false, "1");

                case TestLibraryName.SquareIfNumber:
                    return PQP.Language.TypeUtils.definedFunctionFactory(
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
    createLibrarySymbolProviderFn: (library: Library.ILibrary) => new LibrarySymbolProvider(library),
    createLocalDocumentSymbolProviderFn: (
        library: Library.ILibrary,
        maybeTriedInspection: WorkspaceCache.InspectionCacheItem | undefined,
    ) => new LocalDocumentSymbolProvider(library, maybeTriedInspection),
};

export const enum TestLibraryName {
    CreateFooAndBarRecord = "Test.CreateFooAndBarRecord",
    SquareIfNumber = "Test.SquareIfNumber",
    Number = "Test.Number",
    NumberOne = "Test.NumberOne",
}

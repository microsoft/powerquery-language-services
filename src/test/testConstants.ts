// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "@microsoft/powerquery-parser";
import { ExternalType, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    AnalysisOptions,
    Hover,
    Library,
    LibraryUtils,
    LocalDocumentSymbolProvider,
    SignatureHelp,
    WorkspaceCache,
} from "../powerquery-language-services";
import { ILibrary } from "../powerquery-language-services/library/library";
import { LibraryCompletionItemProvider } from "../powerquery-language-services/providers/libraryCompletionItemProvider";

export const NoOpLibrary: Library.ILibrary = {
    externalTypeResolver: ExternalType.noOpExternalTypeResolver,
    libraryDefinitions: new Map(),
};

export const SimpleLibraryDefinitions: Library.LibraryDefinitions = new Map<string, Library.TLibraryDefinition>([
    [
        TestFunctionName.CreateFooAndBarRecord,
        LibraryUtils.createFunctionDefinition(
            Type.FunctionInstance,
            `The name is ${TestFunctionName.CreateFooAndBarRecord}`,
            TestFunctionName.CreateFooAndBarRecord,
            Type.RecordInstance,
            [],
        ),
    ],
    [
        TestFunctionName.Number,
        LibraryUtils.createConstantDefinition(
            Type.NumberInstance,
            `The name is ${TestFunctionName.Number}`,
            TestFunctionName.Number,
            Type.NumberInstance,
        ),
    ],
    [
        TestFunctionName.NumberOne,
        LibraryUtils.createConstantDefinition(
            TypeUtils.numberLiteralFactory(false, "1"),
            `The name is ${TestFunctionName.NumberOne}`,
            TestFunctionName.NumberOne,
            Type.NumberInstance,
        ),
    ],
    [
        TestFunctionName.SquareIfNumber,
        LibraryUtils.createFunctionDefinition(
            TypeUtils.numberLiteralFactory(false, "1"),
            `The name is ${TestFunctionName.SquareIfNumber}`,
            TestFunctionName.SquareIfNumber,
            Type.NumberInstance,
            [
                {
                    label: "x",
                    parameters: [
                        {
                            isNullable: false,
                            isOptional: false,
                            label: "x",
                            maybeDocumentation: undefined,
                            signatureLabelEnd: -1,
                            signatureLabelOffset: -1,
                            typeKind: Type.TypeKind.Number,
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
                case TestFunctionName.SquareIfNumber: {
                    if (request.args.length !== 1) {
                        return Type.NoneInstance;
                    }
                    const arg: Type.TType = Assert.asDefined(request.args[0]);

                    if (TypeUtils.isNumberLiteral(arg)) {
                        return {
                            ...arg,
                            literal: (arg.normalizedLiteral * 2).toString(),
                            normalizedLiteral: arg.normalizedLiteral * 2,
                        };
                    } else if (TypeUtils.isNumber(arg)) {
                        return Type.NumberInstance;
                    } else {
                        return Type.NoneInstance;
                    }
                }

                default:
                    return undefined;
            }

        case ExternalType.ExternalTypeRequestKind.Value:
            switch (request.identifierLiteral) {
                case TestFunctionName.CreateFooAndBarRecord:
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

                case TestFunctionName.Number:
                    return Type.NumberInstance;

                case TestFunctionName.NumberOne:
                    return TypeUtils.numberLiteralFactory(false, "1");

                case TestFunctionName.SquareIfNumber:
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
    createLibraryCompletionItemProviderFn: (library: ILibrary) => new LibraryCompletionItemProvider(library),
    createLocalDocumentSymbolProviderFn: (
        library: ILibrary,
        maybeTriedInspection: WorkspaceCache.TInspectionCacheItem | undefined,
    ) => new LocalDocumentSymbolProvider(library, maybeTriedInspection),
};

export const enum TestFunctionName {
    CreateFooAndBarRecord = "Test.CreateFooAndBarRecord",
    SquareIfNumber = "Test.SquareIfNumber",
    Number = "Test.Number",
    NumberOne = "Test.NumberOne",
}

export const EmptyHover: Hover = {
    range: undefined,
    contents: [],
};

export const EmptySignatureHelp: SignatureHelp = {
    signatures: [],
    // tslint:disable-next-line: no-null-keyword
    activeParameter: null,
    activeSignature: 0,
};

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, expect, it } from "bun:test";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import {
    CompletionItemKind,
    type Library,
    LibraryDefinitionUtils,
    LibrarySymbolUtils,
} from "../powerquery-language-services";
import { ExtendedTypeKind, TypeKind } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";
import {
    type FailedLibrarySymbolConversion,
    FailedLibrarySymbolConversionKind,
} from "../powerquery-language-services/library/librarySymbolUtils";
import { LibraryDefinitionKind, type TLibraryDefinition } from "../powerquery-language-services/library/library";
import { type Result, ResultUtils } from "@microsoft/powerquery-parser";
import { type LibrarySymbol } from "../powerquery-language-services/library/librarySymbol";
import { TestConstants } from ".";

describe("Library", () => {
    function createLibrary(params: {
        readonly staticLibraryDefinitions?: ReadonlyMap<string, Library.TLibraryDefinition>;
        readonly dynamicLibraryDefinitions?: () => ReadonlyMap<string, Library.TLibraryDefinition>;
    }): Library.ILibrary {
        const dynamicLibraryDefinitions: () => ReadonlyMap<string, Library.TLibraryDefinition> =
            params.dynamicLibraryDefinitions ?? TestConstants.EmptyLibrary.libraryDefinitions.dynamicLibraryDefinitions;

        const staticLibraryDefinitions: ReadonlyMap<string, Library.TLibraryDefinition> =
            params.staticLibraryDefinitions ?? TestConstants.EmptyLibrary.libraryDefinitions.staticLibraryDefinitions;

        return {
            ...TestConstants.EmptyLibrary,
            externalTypeResolver: TestConstants.EmptyLibrary.externalTypeResolver,
            libraryDefinitions: {
                ...TestConstants.EmptyLibrary.libraryDefinitions,
                dynamicLibraryDefinitions,
                staticLibraryDefinitions,
            },
        };
    }

    describe("LibraryDefinitionUtils", () => {
        describe("getDefinition and hasDefinition", () => {
            function runTest(params: {
                readonly library: Library.ILibrary;
                readonly key: string;
                readonly isExpected: boolean;
            }): void {
                const hasResult: boolean = LibraryDefinitionUtils.hasDefinition(
                    params.library.libraryDefinitions,
                    params.key,
                );

                const getResult: Library.TLibraryDefinition | undefined = LibraryDefinitionUtils.getDefinition(
                    params.library.libraryDefinitions,
                    params.key,
                );

                if (params.isExpected) {
                    expect(hasResult).toBe(true);
                    expect(getResult).not.toBe(undefined);
                } else {
                    expect(hasResult).toBe(false);
                    expect(getResult).toBe(undefined);
                }
            }

            const numberDefinition: Library.TLibraryDefinition = LibraryDefinitionUtils.constantDefinition(
                TestConstants.TestLibraryName.Number,
                "number",
                Type.NumberInstance,
                CompletionItemKind.Constant,
            );

            it("static ", () => {
                const library: Library.ILibrary = createLibrary({
                    staticLibraryDefinitions: new Map([[TestConstants.TestLibraryName.Number, numberDefinition]]),
                });

                runTest({ library, key: TestConstants.TestLibraryName.Number, isExpected: true });
                runTest({ library, key: "doesn't exist", isExpected: false });
            });

            it("dynamic ", () => {
                const library: Library.ILibrary = createLibrary({
                    dynamicLibraryDefinitions: () =>
                        new Map([[TestConstants.TestLibraryName.Number, numberDefinition]]),
                });

                runTest({ library, key: TestConstants.TestLibraryName.Number, isExpected: true });
                runTest({ library, key: "doesn't exist", isExpected: false });
            });
        });
    });

    describe("LibrarySymbolUtils", () => {
        describe("createLibraryDefinition", () => {
            function runTest(params: {
                readonly librarySymbol: LibrarySymbol;
                readonly expected: Result<Library.TLibraryDefinition, FailedLibrarySymbolConversionKind>;
            }): void {
                const result: Result<Library.TLibraryDefinition, FailedLibrarySymbolConversion> =
                    LibrarySymbolUtils.createLibraryDefinition(params.librarySymbol);

                if (ResultUtils.isOk(params.expected)) {
                    ResultUtils.assertIsOk(result);
                    expect(result.value).toEqual(params.expected.value);
                } else {
                    ResultUtils.assertIsError(result);
                    expect(result.error.kind).toBe(params.expected.error);
                }
            }

            function createValidLibrarySymbol(overrides?: Partial<LibrarySymbol>): LibrarySymbol {
                return {
                    completionItemKind: CompletionItemKind.Property,
                    documentation: {
                        description: "description",
                        longDescription: "longDescription",
                    },
                    functionParameters: [
                        {
                            allowedValues: undefined,
                            caption: undefined,
                            defaultValue: undefined,
                            description: undefined,
                            enumCaptions: undefined,
                            enumNames: undefined,
                            fields: undefined,
                            isNullable: false,
                            isRequired: false,
                            name: "parameterName",
                            sampleValues: undefined,
                            type: "any",
                        },
                    ],
                    isDataSource: true,
                    name: "name",
                    type: "any",
                    ...overrides,
                };
            }

            function createValidLibraryDefinition(overrides?: Partial<TLibraryDefinition>): TLibraryDefinition {
                return {
                    asPowerQueryType: {
                        extendedKind: ExtendedTypeKind.DefinedFunction,
                        isNullable: false,
                        kind: TypeKind.Function,
                        parameters: [
                            {
                                isNullable: false,
                                isOptional: true,
                                nameLiteral: "parameterName",
                                type: TypeKind.Any,
                            },
                        ],
                        returnType: {
                            extendedKind: undefined,
                            isNullable: false,
                            kind: TypeKind.Any,
                        },
                    },
                    completionItemKind: CompletionItemKind.Property,
                    description: "description",
                    kind: LibraryDefinitionKind.Function,
                    label: "(parameterName: optional any) => any",
                    parameters: [
                        {
                            documentation: undefined,
                            isNullable: false,
                            isOptional: false,
                            label: "parameterName",
                            typeKind: TypeKind.Any,
                        },
                    ],
                    ...overrides,
                };
            }

            it("happy path", () => {
                runTest({
                    librarySymbol: createValidLibrarySymbol(),
                    expected: ResultUtils.ok(createValidLibraryDefinition()),
                });
            });

            it("unknown completionItemKind", () => {
                runTest({
                    librarySymbol: createValidLibrarySymbol({
                        completionItemKind: "unknown" as unknown as number,
                    }),
                    expected: ResultUtils.error(FailedLibrarySymbolConversionKind.CompletionItemKind),
                });
            });

            it("unknown definedFunction", () => {
                runTest({
                    librarySymbol: createValidLibrarySymbol({
                        functionParameters: [
                            {
                                type: "unknown",
                            },
                        ] as unknown as [],
                    }),
                    expected: ResultUtils.error(FailedLibrarySymbolConversionKind.DefinedFunction),
                });
            });

            it("unknown type", () => {
                runTest({
                    librarySymbol: createValidLibrarySymbol({
                        type: "unknown" as unknown as string,
                    }),
                    expected: ResultUtils.error(FailedLibrarySymbolConversionKind.PrimitiveType),
                });
            });
        });
    });
});

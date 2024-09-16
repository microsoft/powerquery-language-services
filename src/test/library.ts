// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import {
    CompletionItemKind,
    Library,
    LibraryDefinitionUtils,
    LibrarySymbolUtils,
} from "../powerquery-language-services";
import { ExtendedTypeKind, TypeKind } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";
import { LibraryDefinitionKind, TLibraryDefinition } from "../powerquery-language-services/library/library";
import { Result, ResultUtils } from "@microsoft/powerquery-parser";
import { FailedLibrarySymbolConversion } from "../powerquery-language-services/library/librarySymbolUtils";
import { LibrarySymbol } from "../powerquery-language-services/library/librarySymbol";
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
                    expect(hasResult).to.equal(true);
                    expect(getResult).to.not.equal(undefined);
                } else {
                    expect(hasResult).to.equal(false);
                    expect(getResult).to.equal(undefined);
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
                readonly expected: Result<Library.TLibraryDefinition, FailedLibrarySymbolConversion>;
            }): void {
                const result: Result<Library.TLibraryDefinition, FailedLibrarySymbolConversion> =
                    LibrarySymbolUtils.createLibraryDefinition(params.librarySymbol);

                if (ResultUtils.isOk(params.expected)) {
                    ResultUtils.assertIsOk(result);
                    expect(result.value).to.deep.equal(params.expected.value);
                } else {
                    ResultUtils.assertIsError(result);
                    expect(result.error).to.equal(params.expected.error);
                }
            }

            const validLibrarySymbol: LibrarySymbol = {
                completionItemKind: 10,
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
            };

            const validLibraryDefinition: TLibraryDefinition = {
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
                completionItemKind: 10,
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
            };

            it("happy path", () => {
                runTest({
                    librarySymbol: validLibrarySymbol,
                    expected: ResultUtils.ok(validLibraryDefinition),
                });
            });
        });
    });
});

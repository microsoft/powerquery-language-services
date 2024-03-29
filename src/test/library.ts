// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { CompletionItemKind, Library, LibraryDefinitionUtils } from "../powerquery-language-services";
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
});

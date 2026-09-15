// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Keyword, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { expect } from "chai";

import {
    AnalysisSettings,
    CompletionItemKind,
    ExternalType,
    Inspection,
    Library,
    LibraryDefinitionUtils,
} from "../powerquery-language-services";
import { TestConstants, TestUtils } from ".";

// [Owner("amv146")]
describe("Library identifier lookup", () => {
    const numberDefinition: Library.TLibraryDefinition = LibraryDefinitionUtils.constantDefinition(
        "number",
        "A numeric query",
        Type.NumberInstance,
        CompletionItemKind.Constant,
    );

    const textDefinition: Library.TLibraryDefinition = LibraryDefinitionUtils.constantDefinition(
        "text",
        "A text query",
        Type.TextInstance,
        CompletionItemKind.Constant,
    );

    for (const source of ["static", "dynamic"]) {
        describe(source, () => {
            for (const [key, reference] of [
                ["Query1", '#"Query1"'],
                ['#"Query1"', "Query1"],
                ["Query.Name", '#"Query.Name"'],
                ['#"let"', "let"],
                ['#"null"', "null"],
                ['#"true"', "true"],
            ]) {
                it(`resolves definition ${key} using ${reference}`, () => {
                    const definitions: ReadonlyMap<string, Library.TLibraryDefinition> = new Map([
                        [key, numberDefinition],
                    ]);

                    const library: Library.ILibrary = createLibrary(
                        source === "static" ? definitions : new Map(),
                        () => (source === "dynamic" ? definitions : new Map()),
                    );

                    expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, reference)).to.equal(
                        numberDefinition,
                    );

                    expect(LibraryDefinitionUtils.hasDefinition(library.libraryDefinitions, reference)).to.equal(true);

                    expect(
                        library.externalTypeResolver({
                            kind: ExternalType.ExternalTypeRequestKind.Value,
                            identifierLiteral: reference,
                        }),
                    ).to.equal(Type.NumberInstance);

                    expect(LibraryDefinitionUtils.getKeys(library.libraryDefinitions)).to.deep.equal([key]);
                });
            }
        });
    }

    for (const keyword of Keyword.KeywordKinds.filter((value: string) => !value.startsWith("#"))) {
        it(`resolves the normalized keyword ${keyword}`, () => {
            const library: Library.ILibrary = createLibrary(
                new Map(),
                () => new Map([[`#"${keyword}"`, numberDefinition]]),
            );

            expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, keyword)).to.equal(
                numberDefinition,
            );
        });
    }

    it("preserves exact-match preference within a library", () => {
        const library: Library.ILibrary = createLibrary(
            new Map([
                ["Query1", numberDefinition],
                ['#"Query1"', textDefinition],
            ]),
        );

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Query1")).to.equal(numberDefinition);
        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, '#"Query1"')).to.equal(textDefinition);
    });

    it("preserves static precedence over equivalent dynamic definitions", () => {
        const library: Library.ILibrary = createLibrary(
            new Map([['#"Query1"', numberDefinition]]),
            () => new Map([["Query1", textDefinition]]),
        );

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Query1")).to.equal(numberDefinition);
    });

    it("reads dynamic definitions once per lookup without caching old values", () => {
        let calls: number = 0;
        let definitions: ReadonlyMap<string, Library.TLibraryDefinition> = new Map([['#"Query1"', numberDefinition]]);

        const library: Library.ILibrary = createLibrary(new Map(), () => {
            calls += 1;

            return definitions;
        });

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Query1")).to.equal(numberDefinition);
        expect(calls).to.equal(1);

        definitions = new Map([['#"Query1"', textDefinition]]);

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Query1")).to.equal(textDefinition);
        expect(calls).to.equal(2);
    });

    it("does not request dynamic definitions for a static match", () => {
        let calls: number = 0;

        const library: Library.ILibrary = createLibrary(new Map([["Query1", numberDefinition]]), () => {
            calls += 1;

            return new Map();
        });

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, '#"Query1"')).to.equal(
            numberDefinition,
        );

        expect(calls).to.equal(0);
    });

    it("keeps quoted-looking raw names distinct from ordinary names", () => {
        const library: Library.ILibrary = createLibrary(
            new Map([
                ["Query1", numberDefinition],
                ['#"#""Query1"""', textDefinition],
            ]),
        );

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, '#"Query1"')).to.equal(
            numberDefinition,
        );

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, '#"#""Query1"""')).to.equal(
            textDefinition,
        );
    });

    for (const key of ['#"a""b"', '#"#(#)(lf)"', '#"line#(lf)break"', '#"Source Query"']) {
        it(`preserves escaped and required-quote identifiers: ${key}`, () => {
            const library: Library.ILibrary = createLibrary(new Map([[key, numberDefinition]]));

            expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, key)).to.equal(numberDefinition);
            expect(LibraryDefinitionUtils.getKeys(library.libraryDefinitions)).to.deep.equal([key]);
        });
    }

    it("preserves built-ins and case-sensitive lookup", () => {
        const library: Library.ILibrary = createLibrary(
            new Map([
                ["#date", numberDefinition],
                ["Query1", numberDefinition],
            ]),
            () => new Map([['#"let"', textDefinition]]),
        );

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "#date")).to.equal(numberDefinition);
        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "query1")).to.equal(undefined);
        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Let")).to.equal(undefined);
        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, '#"Unterminated')).to.equal(undefined);
    });

    describe("analysis consumers", () => {
        for (const [key, reference] of [
            ["Query1", '#"Query1"'],
            ['#"Query1"', "Query1"],
            ['#"let"', '#"let"'],
            ['#"null"', '#"null"'],
        ]) {
            it(`infers and hovers ${key} referenced as ${reference}`, async () => {
                const library: Library.ILibrary = createLibrary(new Map(), () => new Map([[key, numberDefinition]]));
                const settings: AnalysisSettings = analysisSettings(library);

                await TestUtils.assertEqualRootType({
                    text: reference,
                    expected: Type.NumberInstance,
                    settings: settings.inspectionSettings,
                });

                await TestUtils.assertEqualHoverAnalysis({
                    textWithPipe: `${reference}|`,
                    expected: `[library constant] ${reference}: number`,
                    analysisSettings: settings,
                });
            });
        }

        for (const [key, reference] of [
            ["Query1", '#"Query1"'],
            ['#"Query1"', "Query1"],
            ['#"let"', '#"let"'],
        ]) {
            it(`provides signature help for ${key} referenced as ${reference}`, async () => {
                const definition: Library.LibraryFunction = LibraryDefinitionUtils.functionDefinition(
                    "Query function",
                    "A query function",
                    TestConstants.SquareIfNumberDefinedFunction,
                    CompletionItemKind.Function,
                    [],
                );

                const library: Library.ILibrary = createLibrary(new Map(), () => new Map([[key, definition]]));

                await TestUtils.assertEqualSignatureHelpAnalysis({
                    textWithPipe: `${reference}(|`,
                    expected: {
                        activeParameter: 0,
                        activeSignature: 0,
                        signatures: [LibraryDefinitionUtils.signatureInformation(definition)],
                    },
                    analysisSettings: analysisSettings(library),
                });
            });
        }

        it("does not add duplicate completion entries for lookup aliases", async () => {
            const library: Library.ILibrary = createLibrary(
                new Map(),
                () => new Map([['#"Query1"', numberDefinition]]),
            );

            const completions: Inspection.AutocompleteItem[] | undefined = await TestUtils.assertAutocompleteAnalysis({
                textWithPipe: "Query|",
                analysisSettings: analysisSettings(library),
            });

            const queryCompletions: Inspection.AutocompleteItem[] | undefined = completions?.filter(
                (item: Inspection.AutocompleteItem) => item.label.includes("Query1"),
            );

            expect(queryCompletions).to.have.lengthOf(1);
            expect(queryCompletions?.[0]?.label).to.equal('#"Query1"');
        });
    });
});

function createLibrary(
    staticLibraryDefinitions: ReadonlyMap<string, Library.TLibraryDefinition>,
    dynamicLibraryDefinitions: () => ReadonlyMap<string, Library.TLibraryDefinition> = () => new Map(),
): Library.ILibrary {
    const libraryDefinitions: Library.LibraryDefinitions = {
        staticLibraryDefinitions,
        dynamicLibraryDefinitions,
    };

    return {
        libraryDefinitions,
        externalTypeResolver: LibraryDefinitionUtils.externalTypeResolver(libraryDefinitions),
    };
}

function analysisSettings(library: Library.ILibrary): AnalysisSettings {
    return {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        inspectionSettings: {
            ...TestConstants.SimpleInspectionSettings,
            library,
        },
    };
}

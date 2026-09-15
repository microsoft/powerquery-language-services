// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import {
    AnalysisSettings,
    CompletionItemKind,
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
        it(`prefers exact matches within the ${source} library`, () => {
            const definitions: ReadonlyMap<string, Library.TLibraryDefinition> = new Map([
                ["Query1", numberDefinition],
                ['#"Query1"', textDefinition],
            ]);

            const library: Library.ILibrary = createLibrary(source === "static" ? definitions : new Map(), () =>
                source === "dynamic" ? definitions : new Map(),
            );

            expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Query1")).to.equal(
                numberDefinition,
            );

            expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, '#"Query1"')).to.equal(
                textDefinition,
            );
        });
    }

    it("prefers a static alias over an exact dynamic match", () => {
        const library: Library.ILibrary = createLibrary(
            new Map([['#"Query1"', numberDefinition]]),
            () => new Map([["Query1", textDefinition]]),
        );

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Query1")).to.equal(numberDefinition);
    });

    it("observes updated dynamic definitions when resolving an alias", () => {
        let definitions: ReadonlyMap<string, Library.TLibraryDefinition> = new Map([['#"Query1"', numberDefinition]]);
        const library: Library.ILibrary = createLibrary(new Map(), () => definitions);

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Query1")).to.equal(numberDefinition);

        definitions = new Map([['#"Query1"', textDefinition]]);

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Query1")).to.equal(textDefinition);
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

    it("does not conflate built-ins or differently cased names", () => {
        const library: Library.ILibrary = createLibrary(
            new Map([["#date", numberDefinition]]),
            () =>
                new Map([
                    ['#"#date"', textDefinition],
                    ['#"Query1"', textDefinition],
                ]),
        );

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "#date")).to.equal(numberDefinition);
        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, '#"#date"')).to.equal(textDefinition);
        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "query1")).to.equal(undefined);
    });

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

    it("resolves a keyword-named function's return type and signature", async () => {
        const definition: Library.LibraryFunction = LibraryDefinitionUtils.assertAsFunction(
            TestConstants.SimpleLibraryDefinitions.staticLibraryDefinitions.get(
                TestConstants.TestLibraryName.DuplicateText,
            ),
        );

        const library: Library.ILibrary = createLibrary(new Map(), () => new Map([['#"let"', definition]]));
        const settings: AnalysisSettings = analysisSettings(library);

        await TestUtils.assertEqualRootType({
            text: '#"let"("value")',
            expected: Type.TextInstance,
            settings: settings.inspectionSettings,
        });

        await TestUtils.assertEqualSignatureHelpAnalysis({
            textWithPipe: '#"let"(|',
            expected: {
                activeParameter: 0,
                activeSignature: 0,
                signatures: [LibraryDefinitionUtils.signatureInformation(definition)],
            },
            analysisSettings: settings,
        });
    });

    it("does not duplicate completions after resolving an alias", async () => {
        const definitions: ReadonlyMap<string, Library.TLibraryDefinition> = new Map([['#"Query1"', numberDefinition]]);
        const library: Library.ILibrary = createLibrary(new Map(), () => definitions);

        expect(LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, "Query1")).to.equal(numberDefinition);

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

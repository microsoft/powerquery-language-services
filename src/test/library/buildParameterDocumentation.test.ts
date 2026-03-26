// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { CompletionItemKind } from "vscode-languageserver-types";

import { Library, LibrarySymbolUtils } from "../../powerquery-language-services";
import { LibrarySymbol, LibrarySymbolFunctionParameter } from "../../powerquery-language-services/library/librarySymbol";

function createLibrarySymbolWithParameter(paramOverrides: Partial<LibrarySymbolFunctionParameter>): LibrarySymbol {
    return {
        name: "TestFunction",
        documentation: { description: "test function", longDescription: null },
        completionItemKind: CompletionItemKind.Function,
        isDataSource: false,
        type: "any",
        functionParameters: [
            {
                name: "param1",
                type: "text",
                isRequired: true,
                isNullable: false,
                caption: undefined,
                description: undefined,
                sampleValues: undefined,
                allowedValues: undefined,
                defaultValue: undefined,
                fields: undefined,
                enumNames: undefined,
                enumCaptions: undefined,
                ...paramOverrides,
            },
        ],
    };
}

function getParameterDocumentation(librarySymbol: LibrarySymbol): string | undefined {
    const result = LibrarySymbolUtils.createLibraryDefinition(librarySymbol);
    ResultUtils.assertIsOk(result);
    const funcDef: Library.LibraryFunction = result.value as Library.LibraryFunction;

    return funcDef.parameters[0].documentation;
}

describe("buildParameterDocumentation", () => {
    it("parameter with only description", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                description: "A text parameter",
            }),
        );

        expect(documentation).to.equal("A text parameter\n\nType: `text`");
    });

    it("parameter with caption and description", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                caption: "Column Name",
                description: "Pick a column",
            }),
        );

        expect(documentation).to.equal("**Column Name**\n\nPick a column\n\nType: `text`");
    });

    it("parameter with all fields", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                caption: "Caption",
                description: "description text",
                defaultValue: "hello",
                allowedValues: ["a", "b"],
                sampleValues: ["x", "y"],
            }),
        );

        expect(documentation).to.equal(
            "**Caption**\n\ndescription text\n\nDefault: `hello`\n\nAllowed values: `a`, `b`\n\nSample values: `x`, `y`\n\nType: `text`",
        );
    });

    it("parameter with no documentation fields returns undefined", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                caption: undefined,
                description: undefined,
                defaultValue: undefined,
                allowedValues: undefined,
                sampleValues: undefined,
            }),
        );

        expect(documentation).to.equal(undefined);
    });

    it("parameter with type only returns undefined", () => {
        // type exists but no other content so parts.length is 0 before type check
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                type: "text",
                caption: undefined,
                description: undefined,
                defaultValue: undefined,
                allowedValues: undefined,
                sampleValues: undefined,
            }),
        );

        expect(documentation).to.equal(undefined);
    });

    it("parameter with description and type includes both", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                description: "some description",
                type: "number",
            }),
        );

        expect(documentation).to.equal("some description\n\nType: `number`");
    });

    it("parameter with defaultValue", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                defaultValue: "myDefault",
            }),
        );

        expect(documentation).to.contain("Default: `myDefault`");
    });

    it("parameter with allowedValues", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                allowedValues: ["v1", "v2"],
            }),
        );

        expect(documentation).to.contain("Allowed values: `v1`, `v2`");
    });

    it("parameter with sampleValues", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                sampleValues: ["v1", "v2"],
            }),
        );

        expect(documentation).to.contain("Sample values: `v1`, `v2`");
    });

    it("parameter with numeric defaultValue", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                defaultValue: 42,
            }),
        );

        expect(documentation).to.contain("Default: `42`");
    });

    it("parameter with numeric allowedValues", () => {
        const documentation: string | undefined = getParameterDocumentation(
            createLibrarySymbolWithParameter({
                allowedValues: [1, 2, 3],
            }),
        );

        expect(documentation).to.contain("Allowed values: `1`, `2`, `3`");
    });
});

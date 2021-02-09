// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert, expect } from "chai";
import "mocha";
import { MarkedString, MarkupContent } from "vscode-languageserver-types";

import * as TestConstants from "../testConstants";
import * as TestUtils from "../testUtils";

import { AnalysisOptions, Hover, Analysis } from "../../powerquery-language-services";
import { LocalDocumentSymbolProvider } from "../../powerquery-language-services/providers/localDocumentSymbolProvider";

describe(`LocalDocumentSymbolProvider using SimpleLibraryDefinitions`, () => {
    describe(`getHover`);
    const assertHoverItems: (text: string, items: ReadonlyArray<string>) => void = (
        text: string,
        items: ReadonlyArray<string>,
    ) => {};

    it(`exact match`, () => {});
});

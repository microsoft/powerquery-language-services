// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Lexer, ResultUtils } from "../../src";
import { IdentifierUtils, Token } from "../../src/language";
import { IdentifierKind } from "../../src/language/identifierUtils";

describe("IdentifierUtils", () => {
    function createCommonIdentifierUtilsOptions(
        overrides?: Partial<IdentifierUtils.CommonIdentifierUtilsOptions>,
    ): IdentifierUtils.CommonIdentifierUtilsOptions {
        return {
            allowTrailingPeriod: false,
            allowGeneralizedIdentifier: false,
            ...overrides,
        };
    }

    function createGetAllowedIdentifiersOptions(
        overrides?: Partial<IdentifierUtils.GetAllowedIdentifiersOptions>,
    ): IdentifierUtils.GetAllowedIdentifiersOptions {
        return {
            allowRecursive: false,
            ...overrides,
        };
    }

    describe("isQuotedIdentifier", () => {
        for (const [text, expected] of [
            ['#"foo"', true],
            ['#"my value"', true],
            ['#""', true],
            ['#""""', true],
            ['#"foo""bar"', true],
            ['#"foo"""', true],
            ['#"a""""b"', true],
            ['#"line\nbreak"', true],
            ['#"let"', true],
            ['#"null"', true],
            ["", false],
            ["foo", false],
            ["let", false],
            ["null", false],
            ['"foo"', false],
            ['@#"foo"', false],
            [' #"foo"', false],
            ['#"foo" ', false],
            ['#"foo"junk', false],
            ['#"foo"junk"', false],
            ['#"foo"#"bar"', false],
            ['#"', false],
            ['#"foo', false],
            ['#"""', false],
            ['#"foo""', false],
            ['#"foo""""', false],
        ] as const) {
            it(JSON.stringify(text), () => {
                expect(IdentifierUtils.isQuotedIdentifier(text)).to.equal(expected);

                if (text.startsWith('#"')) {
                    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);

                    const isCompleteIdentifier: boolean =
                        ResultUtils.isOk(triedLex) &&
                        triedLex.value.tokens.length === 1 &&
                        triedLex.value.tokens[0]?.kind === Token.TokenKind.Identifier &&
                        triedLex.value.tokens[0]?.data === text;

                    expect(isCompleteIdentifier, "lexer agrees on complete quoted identifiers").to.equal(expected);
                }
            });
        }
    });

    describe("malformed quoted identifiers", () => {
        for (const text of ['#"foo"junk', '#"foo"junk"', '#"foo" ', '#"""', '#"foo""', '#"foo""""']) {
            it(`rejects ${JSON.stringify(text)} in identifier utilities`, () => {
                for (const allowGeneralizedIdentifier of [false, true]) {
                    const options: IdentifierUtils.CommonIdentifierUtilsOptions = { allowGeneralizedIdentifier };

                    expect(IdentifierUtils.getIdentifierKind(text, options)).to.equal(IdentifierKind.Invalid);
                    expect(IdentifierUtils.getNormalizedIdentifier(text, options)).to.be.undefined;
                    expect(IdentifierUtils.getAllowedIdentifiers(text, options)).to.deep.equal([]);
                }
            });
        }
    });

    describe(`getAllowedIdentifiers`, () => {
        function getAllowedIdentifiersTest(params: {
            readonly text: string;
            readonly expected: ReadonlyArray<string>;
            readonly options?: Partial<IdentifierUtils.GetAllowedIdentifiersOptions>;
        }): void {
            const text: string = params.text;

            const options: IdentifierUtils.GetAllowedIdentifiersOptions = createGetAllowedIdentifiersOptions(
                params.options,
            );

            const actual: ReadonlyArray<string> = IdentifierUtils.getAllowedIdentifiers(text, options);
            expect(actual).to.have.members(params.expected);
        }

        it("foo", () => {
            getAllowedIdentifiersTest({
                text: "foo",
                expected: ["foo", `#"foo"`],
            });
        });

        it("[empty string]", () => {
            getAllowedIdentifiersTest({
                text: "",
                expected: [],
            });
        });

        it("foo. // allowTrailingPeriod - true", () => {
            getAllowedIdentifiersTest({
                text: "foo.",
                options: { allowTrailingPeriod: true },
                expected: ["foo.", `#"foo."`],
            });
        });

        it("foo. // allowTrailingPeriod - false", () => {
            getAllowedIdentifiersTest({
                text: "foo.",
                options: { allowTrailingPeriod: false },
                expected: [],
            });
        });

        it("foo.bar", () => {
            getAllowedIdentifiersTest({
                text: "foo.bar",
                expected: ["foo.bar", `#"foo.bar"`],
            });
        });

        it("foo.1", () => {
            getAllowedIdentifiersTest({
                text: "foo.1",
                expected: ["foo.1", `#"foo.1"`],
            });
        });

        it("with space // allowGeneralizedIdentifier - false", () => {
            getAllowedIdentifiersTest({
                text: "with space",
                options: { allowGeneralizedIdentifier: false },
                expected: [],
            });
        });

        it("with space // allowGeneralizedIdentifier - true", () => {
            getAllowedIdentifiersTest({
                text: "with space",
                options: { allowGeneralizedIdentifier: true },
                expected: ["with space", `#"with space"`],
            });
        });

        it(`#"regularIdentifierWithUnneededQuotes" // allowGeneralizedIdentifier - false`, () => {
            getAllowedIdentifiersTest({
                text: '#"regularIdentifierWithUnneededQuotes"',
                options: { allowGeneralizedIdentifier: false },
                expected: ["regularIdentifierWithUnneededQuotes", `#"regularIdentifierWithUnneededQuotes"`],
            });
        });

        it(`#"quoted regular identifier" // allowGeneralizedIdentifier - false`, () => {
            getAllowedIdentifiersTest({
                text: '#"quoted regular identifier"',
                options: { allowGeneralizedIdentifier: false },
                expected: [`#"quoted regular identifier"`],
            });
        });

        it(`#"quoted generalized identifier" // allowGeneralizedIdentifier - true`, () => {
            getAllowedIdentifiersTest({
                text: '#"quoted generalized identifier"',
                options: { allowGeneralizedIdentifier: true },
                expected: ["quoted generalized identifier", `#"quoted generalized identifier"`],
            });
        });

        it("foo // allowRecursive - true", () => {
            getAllowedIdentifiersTest({
                text: "foo",
                options: { allowRecursive: true },
                expected: ["foo", `#"foo"`, "@foo", `@#"foo"`],
            });
        });
    });

    describe(`getIdentifierKind`, () => {
        function runGetIdentifierKindTest(params: {
            readonly text: string;
            readonly expected: IdentifierKind;
            readonly options?: Partial<IdentifierUtils.CommonIdentifierUtilsOptions>;
        }): void {
            const text: string = params.text;

            const options: IdentifierUtils.CommonIdentifierUtilsOptions = createCommonIdentifierUtilsOptions(
                params.options,
            );

            const actual: IdentifierKind = IdentifierUtils.getIdentifierKind(text, options);
            expect(actual).to.equal(params.expected);
        }

        for (const text of ["let", "null"]) {
            it(`preserves lexical-shape classification for ${text}`, () => {
                expect(IdentifierUtils.getIdentifierKind(text)).to.equal(IdentifierKind.Regular);
                expect(IdentifierUtils.getIdentifierKind(`#"${text}"`)).to.equal(IdentifierKind.RegularWithQuotes);
            });
        }

        it("foo", () => {
            runGetIdentifierKindTest({
                text: "foo",
                expected: IdentifierKind.Regular,
            });
        });

        it("", () => {
            runGetIdentifierKindTest({
                text: "",
                expected: IdentifierKind.Invalid,
            });
        });

        it("foo. // allowTrailingPeriod - true", () => {
            runGetIdentifierKindTest({
                text: "foo.",
                options: { allowTrailingPeriod: true },
                expected: IdentifierKind.Regular,
            });
        });

        it("foo. // allowTrailingPeriod - false", () => {
            runGetIdentifierKindTest({
                text: "foo.",
                options: { allowTrailingPeriod: false },
                expected: IdentifierKind.Invalid,
            });
        });

        it("foo.bar", () => {
            runGetIdentifierKindTest({
                text: "foo.bar",
                expected: IdentifierKind.Regular,
            });
        });

        it("foo..bar", () => {
            runGetIdentifierKindTest({
                text: "foo..bar",
                expected: IdentifierKind.Invalid,
            });
        });

        it("foo.bar.baz.green.eggs.and.ham", () => {
            runGetIdentifierKindTest({
                text: "foo.bar.baz.green.eggs.and.ham",
                expected: IdentifierKind.Regular,
            });
        });

        it("foo.bar.baz.green.eggs.and.ham. // allowTrailingPeriod - false", () => {
            runGetIdentifierKindTest({
                text: "foo.bar.baz.green.eggs.and.ham.",
                options: { allowTrailingPeriod: false },
                expected: IdentifierKind.Invalid,
            });
        });

        it("foo.1", () => {
            runGetIdentifierKindTest({
                text: "foo.1",
                expected: IdentifierKind.Regular,
            });
        });

        it("with space // allowGeneralizedIdentifier - false", () => {
            runGetIdentifierKindTest({
                text: "with space",
                options: { allowGeneralizedIdentifier: false },
                expected: IdentifierKind.Invalid,
            });
        });

        it("with space // allowGeneralizedIdentifier - true", () => {
            runGetIdentifierKindTest({
                text: "with space",
                options: { allowGeneralizedIdentifier: true },
                expected: IdentifierKind.Generalized,
            });
        });

        it("with space", () => {
            runGetIdentifierKindTest({
                text: '#"quoteNotNeeded"',
                expected: IdentifierKind.RegularWithQuotes,
            });
        });

        it(`#"quote needed"`, () => {
            runGetIdentifierKindTest({
                text: '#"quote needed"',
                expected: IdentifierKind.RegularWithRequiredQuotes,
            });
        });

        it(`#"quoted generalized identifier"' // allowGeneralizedIdentifier - true`, () => {
            runGetIdentifierKindTest({
                text: '#"quoted generalized identifier"',
                options: { allowGeneralizedIdentifier: true },
                expected: IdentifierKind.GeneralizedWithQuotes,
            });
        });
    });

    describe(`getNormalizedIdentifier`, () => {
        function runGetNormalizedIdentifierTest(params: {
            readonly text: string;
            readonly expectedSuccess: string | undefined;
            readonly options?: Partial<IdentifierUtils.CommonIdentifierUtilsOptions>;
        }): void {
            const text: string = params.text;

            const identifierUtilsOptions: IdentifierUtils.CommonIdentifierUtilsOptions =
                createCommonIdentifierUtilsOptions(params.options);

            const actual: string | undefined = IdentifierUtils.getNormalizedIdentifier(text, identifierUtilsOptions);

            if (params.expectedSuccess !== undefined) {
                expect(actual).to.equal(params.expectedSuccess);
            } else {
                expect(actual).to.be.undefined;
            }
        }

        it("foo", () => {
            runGetNormalizedIdentifierTest({
                text: "foo",
                expectedSuccess: "foo",
            });
        });

        it("[empty string]", () => {
            runGetNormalizedIdentifierTest({
                text: "",
                expectedSuccess: undefined,
            });
        });

        it("foo. // allowTrailingPeriod - true", () => {
            runGetNormalizedIdentifierTest({
                text: "foo.",
                options: { allowTrailingPeriod: true },
                expectedSuccess: "foo.",
            });
        });

        it("foo. // allowTrailingPeriod - false", () => {
            runGetNormalizedIdentifierTest({
                text: "foo.",
                options: { allowTrailingPeriod: false },
                expectedSuccess: undefined,
            });
        });

        it("foo.bar", () => {
            runGetNormalizedIdentifierTest({
                text: "foo.bar",
                expectedSuccess: "foo.bar",
            });
        });

        it("foo.1", () => {
            runGetNormalizedIdentifierTest({
                text: "foo.1",
                expectedSuccess: "foo.1",
            });
        });

        it("with space // allowGeneralizedIdentifier - false", () => {
            runGetNormalizedIdentifierTest({
                text: "with space",
                options: { allowGeneralizedIdentifier: false },
                expectedSuccess: undefined,
            });
        });

        it("with space // allowGeneralizedIdentifier - true", () => {
            runGetNormalizedIdentifierTest({
                text: "with space",
                options: { allowGeneralizedIdentifier: true },
                expectedSuccess: "with space",
            });
        });

        it(`#"regularIdentifierWithUnneededQuotes" // allowGeneralizedIdentifier - false`, () => {
            runGetNormalizedIdentifierTest({
                text: '#"regularIdentifierWithUnneededQuotes"',
                options: { allowGeneralizedIdentifier: false },
                expectedSuccess: "regularIdentifierWithUnneededQuotes",
            });
        });

        it(`#"quoted regular identifier" // allowGeneralizedIdentifier - false`, () => {
            runGetNormalizedIdentifierTest({
                text: '#"quoted regular identifier"',
                options: { allowGeneralizedIdentifier: false },
                expectedSuccess: `#"quoted regular identifier"`,
            });
        });

        it(`#"quoted generalized identifier" // allowGeneralizedIdentifier - true`, () => {
            runGetNormalizedIdentifierTest({
                text: '#"quoted generalized identifier"',
                options: { allowGeneralizedIdentifier: true },
                expectedSuccess: "quoted generalized identifier",
            });
        });

        it("#table", () => {
            runGetNormalizedIdentifierTest({
                text: "#table",
                expectedSuccess: "#table",
            });
        });
    });
});

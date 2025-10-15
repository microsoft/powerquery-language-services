// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, expect, it } from "bun:test";

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { type Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { TestConstants, TestUtils } from "..";
import { type CurrentInvokeExpressionArguments } from "../../powerquery-language-services/inspection";
import { type Inspection } from "../../powerquery-language-services";

function expectNoParameters_givenExtraneousParameter(inspected: Inspection.CurrentInvokeExpression): void {
    expect(inspected.name).toBe(TestConstants.TestLibraryName.CreateFooAndBarRecord);

    Assert.isDefined(inspected.arguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.arguments;

    expect(invokeArgs.argumentOrdinal).toBe(0);
    expect(invokeArgs.givenArgumentTypes).toEqual([TypeUtils.numberLiteral(false, `1`)]);
    expect(invokeArgs.givenArguments.length).toBe(1);
    expect(invokeArgs.numMaxExpectedArguments).toBe(0);
    expect(invokeArgs.numMinExpectedArguments).toBe(0);
    expect(invokeArgs.typeChecked.extraneous.length).toBe(1);
    expect(invokeArgs.typeChecked.invalid.size).toBe(0);
    expect(invokeArgs.typeChecked.missing.length).toBe(0);
    expect(invokeArgs.typeChecked.valid.length).toBe(0);

    expect(invokeArgs.typeChecked.extraneous.includes(0)).toBe(true);
}

function expectText_givenNothing(inspected: Inspection.CurrentInvokeExpression): void {
    expect(inspected.name).toBe(TestConstants.TestLibraryName.DuplicateText);

    Assert.isDefined(inspected.arguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.arguments;

    expect(invokeArgs.argumentOrdinal).toBe(0);
    expect(invokeArgs.givenArgumentTypes).toEqual([]);
    expect(invokeArgs.givenArguments.length).toBe(0);
    expect(invokeArgs.numMaxExpectedArguments).toBe(1);
    expect(invokeArgs.numMinExpectedArguments).toBe(1);
    expect(invokeArgs.typeChecked.extraneous.length).toBe(0);
    expect(invokeArgs.typeChecked.invalid.size).toBe(0);
    expect(invokeArgs.typeChecked.missing.length).toBe(1);
    expect(invokeArgs.typeChecked.valid.length).toBe(0);

    expect(invokeArgs.typeChecked.missing).toEqual([0]);
}

function expectText_givenText(inspected: Inspection.CurrentInvokeExpression): void {
    expect(inspected.name).toBe(TestConstants.TestLibraryName.DuplicateText);

    Assert.isDefined(inspected.arguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.arguments;

    expect(invokeArgs.argumentOrdinal).toBe(0);
    expect(invokeArgs.givenArgumentTypes).toEqual([TypeUtils.textLiteral(false, `"foo"`)]);
    expect(invokeArgs.givenArguments.length).toBe(1);
    expect(invokeArgs.numMaxExpectedArguments).toBe(1);
    expect(invokeArgs.numMinExpectedArguments).toBe(1);
    expect(invokeArgs.typeChecked.extraneous.length).toBe(0);
    expect(invokeArgs.typeChecked.invalid.size).toBe(0);
    expect(invokeArgs.typeChecked.missing.length).toBe(0);
    expect(invokeArgs.typeChecked.valid.length).toBe(1);

    expect(invokeArgs.typeChecked.valid).toEqual([0]);
}

function expectNumberParameter_missingParameter(inspected: Inspection.CurrentInvokeExpression): void {
    expect(inspected.name).toBe(TestConstants.TestLibraryName.SquareIfNumber);

    Assert.isDefined(inspected.arguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.arguments;

    expect(invokeArgs.argumentOrdinal).toBe(0);
    expect(invokeArgs.givenArgumentTypes).toEqual([]);
    expect(invokeArgs.givenArguments.length).toBe(0);
    expect(invokeArgs.numMaxExpectedArguments).toBe(1);
    expect(invokeArgs.numMinExpectedArguments).toBe(1);
    expect(invokeArgs.typeChecked.extraneous.length).toBe(0);
    expect(invokeArgs.typeChecked.invalid.size).toBe(0);
    expect(invokeArgs.typeChecked.missing.length).toBe(1);
    expect(invokeArgs.typeChecked.valid.length).toBe(0);

    expect(invokeArgs.typeChecked.missing.includes(0)).toBe(true);
}

function expectNoParameter_givenNoParameter(inspected: Inspection.CurrentInvokeExpression): void {
    expect(inspected.name).toBe(TestConstants.TestLibraryName.CreateFooAndBarRecord);

    Assert.isDefined(inspected.arguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.arguments;

    expect(invokeArgs.argumentOrdinal).toBe(0);
    expect(invokeArgs.givenArgumentTypes).toEqual([]);
    expect(invokeArgs.givenArguments.length).toBe(0);
    expect(invokeArgs.numMaxExpectedArguments).toBe(0);
    expect(invokeArgs.numMinExpectedArguments).toBe(0);
    expect(invokeArgs.typeChecked.extraneous.length).toBe(0);
    expect(invokeArgs.typeChecked.invalid.size).toBe(0);
    expect(invokeArgs.typeChecked.missing.length).toBe(0);
    expect(invokeArgs.typeChecked.valid.length).toBe(0);
}

function expectRequiredAndOptional_givenRequired(inspected: Inspection.CurrentInvokeExpression): void {
    expect(inspected.name).toBe(TestConstants.TestLibraryName.CombineNumberAndOptionalText);

    Assert.isDefined(inspected.arguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.arguments;

    expect(invokeArgs.argumentOrdinal).toBe(0);
    expect(invokeArgs.givenArgumentTypes).toEqual([TypeUtils.numberLiteral(false, "1")]);
    expect(invokeArgs.givenArguments.length).toBe(1);
    expect(invokeArgs.numMaxExpectedArguments).toBe(2);
    expect(invokeArgs.numMinExpectedArguments).toBe(1);
    expect(invokeArgs.typeChecked.extraneous.length).toBe(0);
    expect(invokeArgs.typeChecked.invalid.size).toBe(0);
    expect(invokeArgs.typeChecked.missing.length).toBe(0);
    expect(invokeArgs.typeChecked.valid.length).toBe(2);

    expect(invokeArgs.typeChecked.valid).toEqual([0, 1]);
}

function expectRequiredAndOptional_givenRequiredAndOptional(inspected: Inspection.CurrentInvokeExpression): void {
    expect(inspected.name).toBe(TestConstants.TestLibraryName.CombineNumberAndOptionalText);

    Assert.isDefined(inspected.arguments);

    const invokeArgs: CurrentInvokeExpressionArguments = inspected.arguments;

    expect(invokeArgs.argumentOrdinal).toBe(1);

    expect(invokeArgs.givenArgumentTypes).toEqual([
        TypeUtils.numberLiteral(false, "1"),
        TypeUtils.textLiteral(false, `"secondArg"`),
    ]);

    expect(invokeArgs.givenArguments.length).toBe(2);
    expect(invokeArgs.numMaxExpectedArguments).toBe(2);
    expect(invokeArgs.numMinExpectedArguments).toBe(1);
    expect(invokeArgs.typeChecked.extraneous.length).toBe(0);
    expect(invokeArgs.typeChecked.invalid.size).toBe(0);
    expect(invokeArgs.typeChecked.missing.length).toBe(0);
    expect(invokeArgs.typeChecked.valid.length).toBe(2);

    expect(invokeArgs.typeChecked.valid).toEqual([0, 1]);
}

function expectText_givenNumber(inspected: Inspection.CurrentInvokeExpression): void {
    const expectedArgument: Type.FunctionParameter = Assert.asDefined(
        TestConstants.DuplicateTextDefinedFunction.parameters[0],
    );

    const actualArgument: Type.NumberLiteral = TypeUtils.numberLiteral(false, "1");

    expect(inspected.name).toBe(TestConstants.TestLibraryName.DuplicateText);

    Assert.isDefined(inspected.arguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.arguments;

    expect(invokeArgs.argumentOrdinal).toBe(0);
    expect(invokeArgs.givenArgumentTypes).toEqual([actualArgument]);
    expect(invokeArgs.givenArguments.length).toBe(1);
    expect(invokeArgs.numMaxExpectedArguments).toBe(1);
    expect(invokeArgs.numMinExpectedArguments).toBe(1);
    expect(invokeArgs.typeChecked.extraneous.length).toBe(0);
    expect(invokeArgs.typeChecked.invalid.size).toBe(1);
    expect(invokeArgs.typeChecked.missing.length).toBe(0);
    expect(invokeArgs.typeChecked.valid.length).toBe(0);

    const invalidArguments: Map<number, TypeUtils.InvocationMismatch> = invokeArgs.typeChecked.invalid;
    const firstArg: TypeUtils.InvocationMismatch = PQP.MapUtils.assertGet(invalidArguments, 0);

    expect(firstArg).toEqual({
        expected: expectedArgument,
        actual: actualArgument,
    });
}

function expectNestedInvocation(inspected: Inspection.CurrentInvokeExpression): void {
    expect(inspected.name).toBe(TestConstants.TestLibraryName.CreateFooAndBarRecord);

    Assert.isDefined(inspected.arguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.arguments;

    expect(invokeArgs.argumentOrdinal).toBe(0);
    expect(invokeArgs.givenArgumentTypes).toEqual([]);
    expect(invokeArgs.givenArguments.length).toBe(0);
    expect(invokeArgs.numMaxExpectedArguments).toBe(0);
    expect(invokeArgs.numMinExpectedArguments).toBe(0);
    expect(invokeArgs.typeChecked.extraneous.length).toBe(0);
    expect(invokeArgs.typeChecked.invalid.size).toBe(0);
    expect(invokeArgs.typeChecked.missing.length).toBe(0);
    expect(invokeArgs.typeChecked.valid.length).toBe(0);
}

describe(`subset Inspection - InvokeExpression`, () => {
    async function assertCurrentInvokeExpression(textWithPipe: string): Promise<Inspection.CurrentInvokeExpression> {
        const inspected: Inspection.Inspected = await TestUtils.assertInspected({
            textWithPipe,
            inspectionSettings: TestConstants.SimpleInspectionSettings,
        });

        return Assert.asDefined(ResultUtils.assertOk(await inspected.triedCurrentInvokeExpression));
    }

    describe(`parse Ok`, () => {
        it("expects no parameters, given no parameters", async () =>
            expectNoParameter_givenNoParameter(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|)`),
            ));

        it("expects no parameters, given extraneous parameter", async () =>
            expectNoParameters_givenExtraneousParameter(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.CreateFooAndBarRecord}(1|)`),
            ));

        it("expect number parameter, missing parameter", async () =>
            expectNumberParameter_missingParameter(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.SquareIfNumber}(|)`),
            ));

        it("expects required and optional, given required", async () =>
            expectRequiredAndOptional_givenRequired(
                await assertCurrentInvokeExpression(
                    `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1|)`,
                ),
            ));

        it("expects required and optional, given required and optional", async () =>
            expectRequiredAndOptional_givenRequiredAndOptional(
                await assertCurrentInvokeExpression(
                    `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1, "secondArg"|)`,
                ),
            ));

        it("expects text, given text", async () =>
            expectText_givenText(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.DuplicateText}("foo"|)`),
            ));

        it("expects text, given nothing", async () =>
            expectText_givenNothing(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.DuplicateText}(|)`),
            ));

        it("expects text, given number", async () =>
            expectText_givenNumber(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.DuplicateText}(1|)`),
            ));

        it("nested invocations, expects no parameters, missing parameter", async () => {
            expectNestedInvocation(
                await assertCurrentInvokeExpression(
                    `Foobar(${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|), Baz)`,
                ),
            );
        });
    });

    describe(`parse error`, () => {
        it("expects no parameters, given no parameters", async () =>
            expectNoParameter_givenNoParameter(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|`),
            ));

        it("expects no parameters, given extraneous parameter", async () =>
            expectNoParameters_givenExtraneousParameter(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.CreateFooAndBarRecord}(1|`),
            ));

        it("expect number parameter, missing parameter", async () =>
            expectNumberParameter_missingParameter(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.SquareIfNumber}(|`),
            ));

        it("expects required and optional, given required", async () =>
            expectRequiredAndOptional_givenRequired(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1|`),
            ));

        it("expects required and optional, given required and optional", async () =>
            expectRequiredAndOptional_givenRequiredAndOptional(
                await assertCurrentInvokeExpression(
                    `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1, "secondArg"|`,
                ),
            ));

        it("expects text, given text", async () =>
            expectText_givenText(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.DuplicateText}("foo"|`),
            ));

        it("expects text, given nothing", async () =>
            expectText_givenNothing(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.DuplicateText}(|`),
            ));

        it("expects text, given number", async () =>
            expectText_givenNumber(
                await assertCurrentInvokeExpression(`${TestConstants.TestLibraryName.DuplicateText}(1|`),
            ));

        it("nested invocations, expects no parameters, missing parameter", async () =>
            expectNestedInvocation(
                await assertCurrentInvokeExpression(
                    `Foobar(${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|), Baz`,
                ),
            ));
    });
});

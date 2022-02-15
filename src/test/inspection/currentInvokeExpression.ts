// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import { Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { Position } from "vscode-languageserver-types";

import { Inspection, InspectionSettings } from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { CurrentInvokeExpressionArguments } from "../../powerquery-language-services/inspection";

function assertParseOkInvokeExpressionOk(
    settings: InspectionSettings,
    text: string,
    position: Position,
): Inspection.CurrentInvokeExpression | undefined {
    const parseOk: PQP.Task.ParseTaskOk = TestUtils.assertGetLexParseOk(settings, text);

    return assertInvokeExpressionOk(settings, parseOk.nodeIdMapCollection, position);
}

function assertParseErrInvokeExpressionOk(
    settings: InspectionSettings,
    text: string,
    position: Position,
): Inspection.CurrentInvokeExpression | undefined {
    const parseError: PQP.Task.ParseTaskParseError = TestUtils.assertGetLexParseError(settings, text);

    return assertInvokeExpressionOk(settings, parseError.nodeIdMapCollection, position);
}

function assertInvokeExpressionOk(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
): Inspection.CurrentInvokeExpression | undefined {
    const activeNode: Inspection.ActiveNode = Inspection.ActiveNodeUtils.assertActiveNode(
        nodeIdMapCollection,
        position,
    );

    const triedInspect: Inspection.TriedCurrentInvokeExpression = Inspection.tryCurrentInvokeExpression(
        settings,
        nodeIdMapCollection,
        activeNode,
    );

    Assert.isOk(triedInspect);

    return triedInspect.value;
}

function expectNoParameters_givenExtraneousParameter(inspected: Inspection.CurrentInvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CreateFooAndBarRecord);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([TypeUtils.createNumberLiteral(false, `1`)]);
    expect(invokeArgs.givenArguments.length).to.equal(1);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(0);
    expect(invokeArgs.numMinExpectedArguments).to.equal(0);
    expect(invokeArgs.typeChecked.extraneous.length).to.equal(1);
    expect(invokeArgs.typeChecked.invalid.size).to.equal(0);
    expect(invokeArgs.typeChecked.missing.length).to.equal(0);
    expect(invokeArgs.typeChecked.valid.length).to.equal(0);

    expect(invokeArgs.typeChecked.extraneous.includes(0)).to.equal(true);
}

function expectText_givenNothing(inspected: Inspection.CurrentInvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.DuplicateText);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([]);
    expect(invokeArgs.givenArguments.length).to.equal(0);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(1);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeChecked.extraneous.length).to.equal(0);
    expect(invokeArgs.typeChecked.invalid.size).to.equal(0);
    expect(invokeArgs.typeChecked.missing.length).to.equal(1);
    expect(invokeArgs.typeChecked.valid.length).to.equal(0);

    expect(invokeArgs.typeChecked.missing).to.deep.equal([0]);
}

function expectText_givenText(inspected: Inspection.CurrentInvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.DuplicateText);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([TypeUtils.createTextLiteral(false, `"foo"`)]);
    expect(invokeArgs.givenArguments.length).to.equal(1);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(1);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeChecked.extraneous.length).to.equal(0);
    expect(invokeArgs.typeChecked.invalid.size).to.equal(0);
    expect(invokeArgs.typeChecked.missing.length).to.equal(0);
    expect(invokeArgs.typeChecked.valid.length).to.equal(1);

    expect(invokeArgs.typeChecked.valid).to.deep.equal([0]);
}

function expectNumberParameter_missingParameter(inspected: Inspection.CurrentInvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.SquareIfNumber);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([]);
    expect(invokeArgs.givenArguments.length).to.equal(0);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(1);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeChecked.extraneous.length).to.equal(0);
    expect(invokeArgs.typeChecked.invalid.size).to.equal(0);
    expect(invokeArgs.typeChecked.missing.length).to.equal(1);
    expect(invokeArgs.typeChecked.valid.length).to.equal(0);

    expect(invokeArgs.typeChecked.missing.includes(0)).to.equal(true);
}

function expectNoParameter_givenNoParameter(inspected: Inspection.CurrentInvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CreateFooAndBarRecord);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([]);
    expect(invokeArgs.givenArguments.length).to.equal(0);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(0);
    expect(invokeArgs.numMinExpectedArguments).to.equal(0);
    expect(invokeArgs.typeChecked.extraneous.length).to.equal(0);
    expect(invokeArgs.typeChecked.invalid.size).to.equal(0);
    expect(invokeArgs.typeChecked.missing.length).to.equal(0);
    expect(invokeArgs.typeChecked.valid.length).to.equal(0);
}

function expectRequiredAndOptional_givenRequired(inspected: Inspection.CurrentInvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CombineNumberAndOptionalText);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([TypeUtils.createNumberLiteral(false, "1")]);
    expect(invokeArgs.givenArguments.length).to.equal(1);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(2);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeChecked.extraneous.length).to.equal(0);
    expect(invokeArgs.typeChecked.invalid.size).to.equal(0);
    expect(invokeArgs.typeChecked.missing.length).to.equal(0);
    expect(invokeArgs.typeChecked.valid.length).to.equal(2);

    expect(invokeArgs.typeChecked.valid).to.deep.equal([0, 1]);
}

function expectRequiredAndOptional_givenRequiredAndOptional(
    inspected: Inspection.CurrentInvokeExpression | undefined,
): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CombineNumberAndOptionalText);

    Assert.isDefined(inspected.maybeArguments);

    const invokeArgs: CurrentInvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(1);

    expect(invokeArgs.givenArgumentTypes).to.deep.equal([
        TypeUtils.createNumberLiteral(false, "1"),
        TypeUtils.createTextLiteral(false, `"secondArg"`),
    ]);

    expect(invokeArgs.givenArguments.length).to.equal(2);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(2);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeChecked.extraneous.length).to.equal(0);
    expect(invokeArgs.typeChecked.invalid.size).to.equal(0);
    expect(invokeArgs.typeChecked.missing.length).to.equal(0);
    expect(invokeArgs.typeChecked.valid.length).to.equal(2);

    expect(invokeArgs.typeChecked.valid).to.deep.equal([0, 1]);
}

function expectText_givenNumber(inspected: Inspection.CurrentInvokeExpression | undefined): void {
    const expectedArgument: Type.FunctionParameter = Assert.asDefined(
        TestConstants.DuplicateTextDefinedFunction.parameters[0],
    );

    const actualArgument: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "1");

    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.DuplicateText);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([actualArgument]);
    expect(invokeArgs.givenArguments.length).to.equal(1);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(1);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeChecked.extraneous.length).to.equal(0);
    expect(invokeArgs.typeChecked.invalid.size).to.equal(1);
    expect(invokeArgs.typeChecked.missing.length).to.equal(0);
    expect(invokeArgs.typeChecked.valid.length).to.equal(0);

    const invalidArguments: Map<number, TypeUtils.InvocationMismatch> = invokeArgs.typeChecked.invalid;
    const firstArg: TypeUtils.InvocationMismatch = PQP.MapUtils.assertGet(invalidArguments, 0);

    expect(firstArg).to.deep.equal({
        expected: expectedArgument,
        actual: actualArgument,
    });
}

function expectNestedInvocation(inspected: Inspection.CurrentInvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CreateFooAndBarRecord);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: CurrentInvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([]);
    expect(invokeArgs.givenArguments.length).to.equal(0);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(0);
    expect(invokeArgs.numMinExpectedArguments).to.equal(0);
    expect(invokeArgs.typeChecked.extraneous.length).to.equal(0);
    expect(invokeArgs.typeChecked.invalid.size).to.equal(0);
    expect(invokeArgs.typeChecked.missing.length).to.equal(0);
    expect(invokeArgs.typeChecked.valid.length).to.equal(0);
}

describe(`subset Inspection - InvokeExpression`, () => {
    describe(`parse Ok`, () => {
        it("expects no parameters, given no parameters", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|)`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectNoParameter_givenNoParameter(inspected);
        });

        it("expects no parameters, given extraneous parameter", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CreateFooAndBarRecord}(1|)`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectNoParameters_givenExtraneousParameter(inspected);
        });

        it("expect number parameter, missing parameter", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.SquareIfNumber}(|)`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectNumberParameter_missingParameter(inspected);
        });

        it("expects required and optional, given required", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1|)`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectRequiredAndOptional_givenRequired(inspected);
        });

        it("expects required and optional, given required and optional", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1, "secondArg"|)`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectRequiredAndOptional_givenRequiredAndOptional(inspected);
        });

        it("expects text, given text", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}("foo"|)`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectText_givenText(inspected);
        });

        it("expects text, given nothing", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}(|)`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectText_givenNothing(inspected);
        });

        it("expects text, given number", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}(1|)`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectText_givenNumber(inspected);
        });

        it("nested invocations, expects no parameters, missing parameter", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `Foobar(${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|), Baz)`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectNestedInvocation(inspected);
        });
    });

    describe(`parse error`, () => {
        it("expects no parameters, given no parameters", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectNoParameter_givenNoParameter(inspected);
        });

        it("expects no parameters, given extraneous parameter", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CreateFooAndBarRecord}(1|`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectNoParameters_givenExtraneousParameter(inspected);
        });

        it("expect number parameter, missing parameter", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.SquareIfNumber}(|`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectNumberParameter_missingParameter(inspected);
        });

        it("expects required and optional, given required", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1|`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectRequiredAndOptional_givenRequired(inspected);
        });

        it("expects required and optional, given required and optional", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1, "secondArg"|`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectRequiredAndOptional_givenRequiredAndOptional(inspected);
        });

        it("expects text, given text", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}("foo"|`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectText_givenText(inspected);
        });

        it("expects text, given nothing", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}(|`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectText_givenNothing(inspected);
        });

        it("expects text, given number", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}(1|`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectText_givenNumber(inspected);
        });

        it("nested invocations, expects no parameters, missing parameter", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `Foobar(${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|), Baz`,
            );

            const inspected: Inspection.CurrentInvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleInspectionSettings,
                text,
                position,
            );

            expectNestedInvocation(inspected);
        });
    });
});

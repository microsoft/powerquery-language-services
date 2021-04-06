// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";
import { Inspection } from "../../powerquery-language-services";

import { TestConstants, TestUtils } from "..";
import { InvokeExpressionArguments } from "../../powerquery-language-services/inspection";
import { InspectionSettings } from "../../powerquery-language-services/inspection/settings";

function assertInvokeExpressionOk(
    settings: InspectionSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Inspection.Position,
): Inspection.InvokeExpression | undefined {
    const activeNode: Inspection.ActiveNode = Inspection.ActiveNodeUtils.assertActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );

    const triedInspect: Inspection.TriedInvokeExpression = Inspection.tryInvokeExpression(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        activeNode,
    );
    Assert.isOk(triedInspect);
    return triedInspect.value;
}

function assertParseOkInvokeExpressionOk(
    settings: PQP.Settings & InspectionSettings,
    text: string,
    position: Inspection.Position,
): Inspection.InvokeExpression | undefined {
    const parseOk: PQP.Task.ParseTaskOk = TestUtils.assertGetLexParseOk(settings, text);
    return assertInvokeExpressionOk(settings, parseOk.nodeIdMapCollection, parseOk.leafNodeIds, position);
}

function assertParseErrInvokeExpressionOk(
    settings: PQP.Settings & InspectionSettings,
    text: string,
    position: Inspection.Position,
): Inspection.InvokeExpression | undefined {
    const parseErr: PQP.Task.ParseTaskParseError = TestUtils.assertGetLexParseErr(settings, text);
    return assertInvokeExpressionOk(settings, parseErr.nodeIdMapCollection, parseErr.leafNodeIds, position);
}

function expectNoParameters_givenExtraneousParameter(inspected: Inspection.InvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CreateFooAndBarRecord);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: InvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([PQP.Language.TypeUtils.createNumberLiteral(false, `1`)]);
    expect(invokeArgs.givenArguments.length).to.equal(1);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(0);
    expect(invokeArgs.numMinExpectedArguments).to.equal(0);
    expect(invokeArgs.typeCheck.extraneous.length).to.equal(1);
    expect(invokeArgs.typeCheck.invalid.length).to.equal(0);
    expect(invokeArgs.typeCheck.missing.length).to.equal(0);
    expect(invokeArgs.typeCheck.valid.length).to.equal(0);

    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.typeCheck.extraneous.includes(0)).to.equal(true);
}

function expectText_givenNothing(inspected: Inspection.InvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.DuplicateText);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: InvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([]);
    expect(invokeArgs.givenArguments.length).to.equal(0);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(1);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeCheck.extraneous.length).to.equal(0);
    expect(invokeArgs.typeCheck.invalid.length).to.equal(0);
    expect(invokeArgs.typeCheck.missing.length).to.equal(1);
    expect(invokeArgs.typeCheck.valid.length).to.equal(0);

    expect(invokeArgs.typeCheck.missing).to.deep.equal([0]);
}

function expectText_givenText(inspected: Inspection.InvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.DuplicateText);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: InvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([PQP.Language.TypeUtils.createTextLiteral(false, `"foo"`)]);
    expect(invokeArgs.givenArguments.length).to.equal(1);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(1);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeCheck.extraneous.length).to.equal(0);
    expect(invokeArgs.typeCheck.invalid.length).to.equal(0);
    expect(invokeArgs.typeCheck.missing.length).to.equal(0);
    expect(invokeArgs.typeCheck.valid.length).to.equal(1);

    expect(invokeArgs.typeCheck.valid).to.deep.equal([0]);
}

function expectNumberParameter_missingParameter(inspected: Inspection.InvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.SquareIfNumber);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: InvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([]);
    expect(invokeArgs.givenArguments.length).to.equal(0);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(1);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeCheck.extraneous.length).to.equal(0);
    expect(invokeArgs.typeCheck.invalid.length).to.equal(0);
    expect(invokeArgs.typeCheck.missing.length).to.equal(1);
    expect(invokeArgs.typeCheck.valid.length).to.equal(0);

    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.typeCheck.missing.includes(0)).to.equal(true);
}

function expectNoParameter_givenNoParameter(inspected: Inspection.InvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CreateFooAndBarRecord);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: InvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([]);
    expect(invokeArgs.givenArguments.length).to.equal(0);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(0);
    expect(invokeArgs.numMinExpectedArguments).to.equal(0);
    expect(invokeArgs.typeCheck.extraneous.length).to.equal(0);
    expect(invokeArgs.typeCheck.invalid.length).to.equal(0);
    expect(invokeArgs.typeCheck.missing.length).to.equal(0);
    expect(invokeArgs.typeCheck.valid.length).to.equal(0);
}

function expectRequiredAndOptional_givenRequired(inspected: Inspection.InvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CombineNumberAndOptionalText);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: InvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([PQP.Language.TypeUtils.createNumberLiteral(false, "1")]);
    expect(invokeArgs.givenArguments.length).to.equal(1);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(2);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeCheck.extraneous.length).to.equal(0);
    expect(invokeArgs.typeCheck.invalid.length).to.equal(0);
    expect(invokeArgs.typeCheck.missing.length).to.equal(0);
    expect(invokeArgs.typeCheck.valid.length).to.equal(2);

    expect(invokeArgs.typeCheck.valid).to.deep.equal([0, 1]);
}

function expectRequiredAndOptional_givenRequiredAndOptional(inspected: Inspection.InvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CombineNumberAndOptionalText);

    Assert.isDefined(inspected.maybeArguments);

    const invokeArgs: InvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(1);
    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([
        PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
        PQP.Language.TypeUtils.createTextLiteral(false, `"secondArg"`),
    ]);
    expect(invokeArgs.givenArguments.length).to.equal(2);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(2);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeCheck.extraneous.length).to.equal(0);
    expect(invokeArgs.typeCheck.invalid.length).to.equal(0);
    expect(invokeArgs.typeCheck.missing.length).to.equal(0);
    expect(invokeArgs.typeCheck.valid.length).to.equal(2);

    expect(invokeArgs.typeCheck.valid).to.deep.equal([0, 1]);
}

function expectText_givenNumber(inspected: Inspection.InvokeExpression | undefined): void {
    const expectedArgument: PQP.Language.Type.FunctionParameter = PQP.Assert.asDefined(
        TestConstants.DuplicateTextDefinedFunction.parameters[0],
    );
    const actualArgument: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(false, "1");

    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.DuplicateText);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: InvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([actualArgument]);
    expect(invokeArgs.givenArguments.length).to.equal(1);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(1);
    expect(invokeArgs.numMinExpectedArguments).to.equal(1);
    expect(invokeArgs.typeCheck.extraneous.length).to.equal(0);
    expect(invokeArgs.typeCheck.invalid.length).to.equal(1);
    expect(invokeArgs.typeCheck.missing.length).to.equal(0);
    expect(invokeArgs.typeCheck.valid.length).to.equal(0);

    const invalidArgument: PQP.Language.TypeUtils.Mismatch<
        number,
        PQP.Language.Type.PowerQueryType | undefined,
        PQP.Language.Type.FunctionParameter
    > = PQP.Assert.asDefined(
        invokeArgs.typeCheck.invalid.find(mismatch => mismatch.key === 0),
        "expected the 0th argument to be invalid",
    );
    expect(invalidArgument).to.deep.equal({
        key: 0,
        expected: expectedArgument,
        actual: actualArgument,
    });
}

function expectNestedInvocation(inspected: Inspection.InvokeExpression | undefined): void {
    Assert.isDefined(inspected);

    expect(inspected.maybeName).to.equal(TestConstants.TestLibraryName.CreateFooAndBarRecord);

    Assert.isDefined(inspected.maybeArguments);
    const invokeArgs: InvokeExpressionArguments = inspected.maybeArguments;

    expect(invokeArgs.argumentOrdinal).to.equal(0);
    // tslint:disable-next-line: chai-vague-errors
    expect(invokeArgs.givenArgumentTypes).to.deep.equal([]);
    expect(invokeArgs.givenArguments.length).to.equal(0);
    expect(invokeArgs.numMaxExpectedArguments).to.equal(0);
    expect(invokeArgs.numMinExpectedArguments).to.equal(0);
    expect(invokeArgs.typeCheck.extraneous.length).to.equal(0);
    expect(invokeArgs.typeCheck.invalid.length).to.equal(0);
    expect(invokeArgs.typeCheck.missing.length).to.equal(0);
    expect(invokeArgs.typeCheck.valid.length).to.equal(0);
}

describe(`subset Inspection - InvokeExpression`, () => {
    describe(`parse Ok`, () => {
        it("expects no parameters, given no parameters", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|)`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectNoParameter_givenNoParameter(inspected);
        });

        it("expects no parameters, given extraneous parameter", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CreateFooAndBarRecord}(1|)`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );
            expectNoParameters_givenExtraneousParameter(inspected);
        });

        it("expect number parameter, missing parameter", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.SquareIfNumber}(|)`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );
            expectNumberParameter_missingParameter(inspected);
        });

        it("expects required and optional, given required", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1|)`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectRequiredAndOptional_givenRequired(inspected);
        });

        it("expects required and optional, given required and optional", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1, "secondArg"|)`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectRequiredAndOptional_givenRequiredAndOptional(inspected);
        });

        it("expects text, given text", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}("foo"|)`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectText_givenText(inspected);
        });

        it("expects text, given nothing", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}(|)`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );
            expectText_givenNothing(inspected);
        });

        it("expects text, given number", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}(1|)`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectText_givenNumber(inspected);
        });

        it("nested invocations, expects no parameters, missing parameter", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `Foobar(${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|), Baz)`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectNestedInvocation(inspected);
        });
    });

    describe(`parse error`, () => {
        it("expects no parameters, given no parameters", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectNoParameter_givenNoParameter(inspected);
        });

        it("expects no parameters, given extraneous parameter", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CreateFooAndBarRecord}(1|`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );
            expectNoParameters_givenExtraneousParameter(inspected);
        });

        it("expect number parameter, missing parameter", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.SquareIfNumber}(|`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );
            expectNumberParameter_missingParameter(inspected);
        });

        it("expects required and optional, given required", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1|`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectRequiredAndOptional_givenRequired(inspected);
        });

        it("expects required and optional, given required and optional", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(1, "secondArg"|`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectRequiredAndOptional_givenRequiredAndOptional(inspected);
        });

        it("expects text, given text", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}("foo"|`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectText_givenText(inspected);
        });

        it("expects text, given nothing", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}(|`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );
            expectText_givenNothing(inspected);
        });

        it("expects text, given number", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `${TestConstants.TestLibraryName.DuplicateText}(1|`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectText_givenNumber(inspected);
        });

        it("WIP nested invocations, expects no parameters, missing parameter", () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `Foobar(${TestConstants.TestLibraryName.CreateFooAndBarRecord}(|), Baz`,
            );
            const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
                TestConstants.SimpleSettings,
                text,
                position,
            );

            expectNestedInvocation(inspected);
        });
    });
});

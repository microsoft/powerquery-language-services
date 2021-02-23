// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";
import { Inspection } from "../../powerquery-language-services";

import { TestUtils } from "..";
import { InspectionSettings } from "../../powerquery-language-services/inspection/settings";

const Settings: PQP.Settings & InspectionSettings = {
    ...PQP.DefaultSettings,
    maybeExternalTypeResolver: undefined,
};

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
    const parseErr: PQP.Task.ParseTaskParseErr = TestUtils.assertGetLexParseErr(settings, text);
    return assertInvokeExpressionOk(settings, parseErr.nodeIdMapCollection, parseErr.leafNodeIds, position);
}

describe(`subset Inspection - InvokeExpression`, () => {
    it("single invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition("Foo(|)");
        const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
            Settings,
            text,
            position,
        );
        Assert.isDefined(inspected);

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).to.equal(undefined, "expected no arguments");
    });

    it("multiple invoke expression, no parameters", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition("Bar(Foo(|))");
        const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
            Settings,
            text,
            position,
        );
        Assert.isDefined(inspected);

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).to.equal(undefined, "expected no arguments");
    });

    it("single invoke expression - Foo(a|)", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition("Foo(a|)");
        const inspected: Inspection.InvokeExpression | undefined = assertParseOkInvokeExpressionOk(
            Settings,
            text,
            position,
        );
        Assert.isDefined(inspected);

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).not.equal(undefined, "expected arguments");
        expect(inspected.maybeArguments?.numArguments).equal(1);
        expect(inspected.maybeArguments?.argumentOrdinal).equal(0);
    });

    it("single invoke expression - Foo(a|,)", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition("Foo(a|,)");
        const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
            Settings,
            text,
            position,
        );
        Assert.isDefined(inspected);

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).not.equal(undefined, "expected arguments");
        expect(inspected.maybeArguments?.numArguments).equal(2);
        expect(inspected.maybeArguments?.argumentOrdinal).equal(0);
    });

    it("single invoke expression - Foo(a,|)", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition("Foo(a,|)");
        const inspected: Inspection.InvokeExpression | undefined = assertParseErrInvokeExpressionOk(
            Settings,
            text,
            position,
        );
        Assert.isDefined(inspected);

        expect(inspected.maybeName).to.equal("Foo");
        expect(inspected.maybeArguments).not.equal(undefined, "expected arguments");
        expect(inspected.maybeArguments?.numArguments).equal(2);
        expect(inspected.maybeArguments?.argumentOrdinal).equal(1);
    });
});

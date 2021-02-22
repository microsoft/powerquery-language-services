// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";

import { TestUtils } from ".";
import { InspectionUtils, Position, SignatureProviderContext } from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";

function expectScope(inspected: PQP.Inspection.Inspection, expected: ReadonlyArray<string>): void {
    if (PQP.ResultUtils.isErr(inspected.triedNodeScope)) {
        throw new Error(`expected inspected.triedNodeScope to be Ok`);
    }

    const inclusiveScopeKeys: ReadonlyArray<string> = [...inspected.triedNodeScope.value.entries()]
        .filter((pair: [string, PQP.Inspection.TScopeItem]) => pair[1].isRecursive === false)
        .map((pair: [string, PQP.Inspection.TScopeItem]) => pair[0]);
    expect(inclusiveScopeKeys).to.have.members(expected);
}

function assertIsPostionInBounds(
    maybeActiveNode: PQP.Inspection.TMaybeActiveNode,
): asserts maybeActiveNode is PQP.Inspection.ActiveNode {
    if (!PQP.Inspection.ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        throw new Error(`expected maybeActiveNode to be an ActiveNode`);
    }
}

// Unit testing for analysis operations related to power query parser inspection results.
describe("InspectedInvokeExpression", () => {
    describe("getContextForInspected", () => {
        it("Date.AddDays(d|,", () => {
            const [document, position]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                "Date.AddDays(d|,",
            );
            const inspected: PQP.Inspection.Inspection = TestUtils.assertGetInspectionCacheItemOk(document, position);
            const maybeContext:
                | SignatureProviderContext
                | undefined = InspectionUtils.getMaybeContextForSignatureProvider(inspected);
            assert.isDefined(maybeContext);
            const context: SignatureProviderContext = maybeContext!;

            expect(context.functionName).to.equal("Date.AddDays");
            expect(context.argumentOrdinal).to.equal(0);
        });

        it("Date.AddDays(d,|", () => {
            const [document, position]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                "Date.AddDays(d,|",
            );
            const inspected: PQP.Inspection.Inspection = TestUtils.assertGetInspectionCacheItemOk(document, position);
            const maybeContext:
                | SignatureProviderContext
                | undefined = InspectionUtils.getMaybeContextForSignatureProvider(inspected);
            assert.isDefined(maybeContext);
            const context: SignatureProviderContext = maybeContext!;

            expect(context.functionName).to.equal("Date.AddDays");
            expect(context.argumentOrdinal).to.equal(1);
        });

        it("Date.AddDays(d,1|", () => {
            const [document, position]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                "Date.AddDays(d,1|",
            );
            const inspected: PQP.Inspection.Inspection = TestUtils.assertGetInspectionCacheItemOk(document, position);
            const maybeContext:
                | SignatureProviderContext
                | undefined = InspectionUtils.getMaybeContextForSignatureProvider(inspected);
            assert.isDefined(maybeContext);
            const context: SignatureProviderContext = maybeContext!;

            expect(context.functionName).to.equal("Date.AddDays");
            expect(context.argumentOrdinal).to.equal(1);
        });

        describe("file", () => {
            it("DirectQueryForSQL file", () => {
                const document: MockDocument = TestUtils.createFileMockDocument("DirectQueryForSQL.pq");
                const position: Position = {
                    line: 68,
                    character: 23,
                };
                const inspected: PQP.Inspection.Inspection = TestUtils.assertGetInspectionCacheItemOk(
                    document,
                    position,
                );

                expectScope(inspected, [
                    "ConnectionString",
                    "Credential",
                    "CredentialConnectionString",
                    "DirectSQL",
                    "DirectSQL.Icons",
                    "DirectSQL.UI",
                    "OdbcDataSource",
                    "database",
                    "server",
                ]);

                const activeNode: PQP.Inspection.TMaybeActiveNode = inspected.maybeActiveNode;
                assertIsPostionInBounds(activeNode);

                TestUtils.assertIsDefined(activeNode.maybeIdentifierUnderPosition);
                expect(activeNode.maybeIdentifierUnderPosition.kind).equals(
                    PQP.Language.Ast.NodeKind.Identifier,
                    "expecting identifier",
                );

                const identifier: PQP.Language.Ast.GeneralizedIdentifier | PQP.Language.Ast.Identifier =
                    activeNode.maybeIdentifierUnderPosition;
                expect(identifier.literal).equals("OdbcDataSource");
                expect(identifier.tokenRange.positionStart.lineNumber).equals(68);
            });
        });
    });
});

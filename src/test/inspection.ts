// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import "mocha";
import { assert, expect } from "chai";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { Inspection, InspectionUtils, Position, SignatureProviderContext } from "../powerquery-language-services";
import { TestConstants, TestUtils } from ".";
import { MockDocument } from "./mockDocument";

function expectScope(inspected: Inspection.Inspection, expected: ReadonlyArray<string>): void {
    if (ResultUtils.isError(inspected.triedNodeScope)) {
        throw new Error(`expected inspected.triedNodeScope to be Ok`);
    }

    const inclusiveScopeKeys: ReadonlyArray<string> = [...inspected.triedNodeScope.value.entries()]
        .filter((pair: [string, Inspection.TScopeItem]) => pair[1].isRecursive === false)
        .map((pair: [string, Inspection.TScopeItem]) => pair[0]);

    expect(inclusiveScopeKeys).to.have.members(expected);
}

function assertIsPostionInBounds(
    maybeActiveNode: Inspection.TMaybeActiveNode,
): asserts maybeActiveNode is Inspection.ActiveNode {
    if (!Inspection.ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        throw new Error(`expected maybeActiveNode to be an ActiveNode`);
    }
}

// Unit testing for analysis operations related to power query parser inspection results.
describe("InspectedInvokeExpression", () => {
    describe("getContextForInspected", () => {
        it(`${TestConstants.TestLibraryName.SquareIfNumber}(1|,`, () => {
            const [document, position]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                `${TestConstants.TestLibraryName.SquareIfNumber}(1|,`,
            );

            const inspected: Inspection.Inspection = TestUtils.assertGetInspectionCacheItem(document, position);

            const maybeContext: SignatureProviderContext | undefined =
                InspectionUtils.getMaybeContextForSignatureProvider(inspected);

            assert.isDefined(maybeContext);
            const context: SignatureProviderContext = maybeContext!;

            expect(context.functionName).to.equal(TestConstants.TestLibraryName.SquareIfNumber);
            expect(context.argumentOrdinal).to.equal(0);
        });

        it(`${TestConstants.TestLibraryName.SquareIfNumber}(d,|`, () => {
            const [document, position]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                `${TestConstants.TestLibraryName.SquareIfNumber}(d,|`,
            );

            const inspected: Inspection.Inspection = TestUtils.assertGetInspectionCacheItem(document, position);

            const maybeContext: SignatureProviderContext | undefined =
                InspectionUtils.getMaybeContextForSignatureProvider(inspected);

            assert.isDefined(maybeContext);
            const context: SignatureProviderContext = maybeContext!;

            expect(context.functionName).to.equal(TestConstants.TestLibraryName.SquareIfNumber);
            expect(context.argumentOrdinal).to.equal(1);
        });

        it(`${TestConstants.TestLibraryName.SquareIfNumber}(d,1|`, () => {
            const [document, position]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                `${TestConstants.TestLibraryName.SquareIfNumber}(d,1|`,
            );

            const inspected: Inspection.Inspection = TestUtils.assertGetInspectionCacheItem(document, position);

            const maybeContext: SignatureProviderContext | undefined =
                InspectionUtils.getMaybeContextForSignatureProvider(inspected);

            assert.isDefined(maybeContext);
            const context: SignatureProviderContext = maybeContext!;

            expect(context.functionName).to.equal(TestConstants.TestLibraryName.SquareIfNumber);
            expect(context.argumentOrdinal).to.equal(1);
        });

        describe("file", () => {
            it("DirectQueryForSQL file", () => {
                const document: MockDocument = TestUtils.createFileMockDocument("DirectQueryForSQL.pq");

                const position: Position = {
                    line: 68,
                    character: 23,
                };

                const inspected: Inspection.Inspection = TestUtils.assertGetInspectionCacheItem(document, position);

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

                const activeNode: Inspection.TMaybeActiveNode = inspected.maybeActiveNode;
                assertIsPostionInBounds(activeNode);

                TestUtils.assertIsDefined(activeNode.maybeIdentifierUnderPosition);

                expect(activeNode.maybeIdentifierUnderPosition.kind).equals(
                    Ast.NodeKind.Identifier,
                    "expecting identifier",
                );

                const identifier: Ast.GeneralizedIdentifier | Ast.Identifier = activeNode.maybeIdentifierUnderPosition;
                expect(identifier.literal).equals("OdbcDataSource");
                expect(identifier.tokenRange.positionStart.lineNumber).equals(68);
            });
        });
    });
});

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import "mocha";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { expect } from "chai";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { Inspection, Position } from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";
import { TestUtils } from ".";

async function expectScope(inspected: Inspection.Inspected, expected: ReadonlyArray<string>): Promise<void> {
    const triedNodeScope: Inspection.TriedNodeScope = await inspected.triedNodeScope;

    if (ResultUtils.isError(triedNodeScope)) {
        throw new Error(`expected triedNodeScope to be Ok`);
    }

    const inclusiveScopeKeys: ReadonlyArray<string> = [...triedNodeScope.value.entries()]
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
    describe("file", () => {
        it("DirectQueryForSQL file", async () => {
            const document: MockDocument = TestUtils.createFileMockDocument("DirectQueryForSQL.pq");

            const position: Position = {
                line: 68,
                character: 23,
            };

            const inspected: Inspection.Inspected = await TestUtils.assertGetInspection(document, position);

            await expectScope(inspected, [
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

            TestUtils.assertIsDefined(activeNode.maybeExclusiveIdentifierUnderPosition);

            expect(activeNode.maybeExclusiveIdentifierUnderPosition.node.kind).equals(
                Ast.NodeKind.IdentifierExpression,
                "expecting identifier",
            );

            const identifier: Ast.GeneralizedIdentifier | Ast.Identifier | Ast.IdentifierExpression =
                activeNode.maybeExclusiveIdentifierUnderPosition.node;

            expect(activeNode.maybeExclusiveIdentifierUnderPosition.normalizedLiteral).equals("OdbcDataSource");
            expect(identifier.tokenRange.positionStart.lineNumber).equals(68);
        });
    });
});

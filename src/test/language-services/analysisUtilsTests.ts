// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";

import { Position } from "../../language-services";
import * as AnalysisUtils from "../../language-services/analysisUtils";
import * as Utils from "./utils";
import { MockDocument } from "./utils";

describe("getTokenAtPosition", () => {
    // it(`|Table.AddColumn()`, () => {
    //     expectToken("Table|.AddColumn()", "Table.AddColumn");
    // });
    it(`Tab|le.AddColumn()`, () => {
        expectToken("Tab|le.AddColumn()", "Table.AddColumn");
    });
    it(`Table|.AddColumn()`, () => {
        expectToken("Table|.AddColumn()", "Table.AddColumn");
    });
    it(`Table.|AddColumn()`, () => {
        expectToken("Table.|AddColumn()", "Table.AddColumn");
    });
    it(`Table.Add|Column()`, () => {
        expectToken("Table.Add|Column()", "Table.AddColumn");
    });
    it(`Table.AddColum|n()`, () => {
        expectToken("Table.AddColum|n()", "Table.AddColumn");
    });
    // it(`Table.AddColumn|()`, () => {
    //     expectToken("Table|.AddColumn()", "Table.AddColumn");
    // });
});

function expectToken(textWithPosition: string, tokenData: string): void {
    const [document, position]: [MockDocument, Position] = Utils.documentAndPositionFrom(textWithPosition);
    const lexerState: PQP.Lexer.State = PQP.Lexer.stateFrom(PQP.DefaultSettings, document.getText());
    const maybeLine: PQP.Lexer.TLine | undefined = lexerState.lines[position.line];
    if (!maybeLine) {
        assert.fail("expected PQP.Lexer.TLine !== undefined");
    }

    const lineTokens: ReadonlyArray<PQP.Language.LineToken> = maybeLine.tokens;
    const token: PQP.Language.LineToken | undefined = AnalysisUtils.getTokenAtPosition(
        lineTokens,
        position,
        document.getText,
    );

    expect(token?.data).to.equal(tokenData, "Unexpected token data");
}

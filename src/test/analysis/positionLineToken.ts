// // Copyright (c) Microsoft Corporation.
// // Licensed under the MIT license.

// // tslint:disable: no-implicit-dependencies
// import * as PQP from "@microsoft/powerquery-parser";
// import { assert, expect } from "chai";
// import "mocha";

// import { LineTokenWithPositionUtils } from "../..";
// import * as Utils from "../testUtils";

// import { LineTokenWithPosition, Position } from "../../powerquery-language-services";
// import { MockDocument } from "../testUtils";

// function expectToken(textWithPosition: string, tokenData: string | undefined): void {
//     const [document, position]: [MockDocument, Position] = Utils.documentAndPositionFrom(textWithPosition);
//     const triedLex: PQP.Lexer.TriedLex = PQP.Lexer.tryLex(PQP.DefaultSettings, document.getText());
//     if (PQP.ResultUtils.isErr(triedLex)) {
//         assert.fail(`expected triedLex to be an Ok`);
//     }
//     const maybeLine: PQP.Lexer.TLine | undefined = triedLex.value.lines[position.line];
//     if (!maybeLine) {
//         assert.fail("expected PQP.Lexer.TLine !== undefined");
//     }

//     const lineTokens: ReadonlyArray<PQP.Language.Token.LineToken> = maybeLine.tokens;
//     const token: LineTokenWithPosition | undefined = LineTokenWithPositionUtils.maybeFrom(position, lineTokens);

//     expect(token?.data).to.equal(tokenData, "Unexpected token data");
// }

// describe("getTokenAtPosition", () => {
//     it(`| Table.AddColumn()`, () => {
//         expectToken("| Table.AddColumn()", undefined);
//     });
//     it(`|Table.AddColumn()`, () => {
//         expectToken("|Table.AddColumn()", undefined);
//     });
//     it(`Tab|le.AddColumn()`, () => {
//         expectToken("Tab|le.AddColumn()", "Table.AddColumn");
//     });
//     it(`Table|.AddColumn()`, () => {
//         expectToken("Table|.AddColumn()", "Table.AddColumn");
//     });
//     it(`Table.|AddColumn()`, () => {
//         expectToken("Table.|AddColumn()", "Table.AddColumn");
//     });
//     it(`Table.Add|Column()`, () => {
//         expectToken("Table.Add|Column()", "Table.AddColumn");
//     });
//     it(`Table.AddColum|n()`, () => {
//         expectToken("Table.AddColum|n()", "Table.AddColumn");
//     });
//     it(`Table.AddColumn|()`, () => {
//         expectToken("Table.AddColumn|()", "Table.AddColumn");
//     });
//     it(`Table.|`, () => {
//         expectToken("Table.|", "Table.");
//     });
//     it(`Table|.`, () => {
//         expectToken("Table|.", "Table.");
//     });
//     it(`|Table.`, () => {
//         expectToken("|Table.", undefined);
//     });
// });

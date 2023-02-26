// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import type { TextEdit } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "..";

describe(`Inspection - RenameEdits - Identifiers`, () => {
    async function runTest(textWithPipe: string, newName: string, expected: TextEdit[] | undefined): Promise<void> {
        await TestUtils.assertEqualRenameEdits(
            textWithPipe,
            newName,
            expected,
            TestConstants.SimpleLibraryAnalysisSettings,
        );
    }

    describe("Rename identifiers", () => {
        async function renameOneIdentifier(textWithPipe: string): Promise<void> {
            await runTest(textWithPipe, "newName", [
                {
                    newText: "newName",
                    range: {
                        end: {
                            character: 21,
                            line: 6,
                        },
                        start: {
                            character: 20,
                            line: 6,
                        },
                    },
                },
                {
                    newText: "newName",
                    range: {
                        end: {
                            character: 21,
                            line: 4,
                        },
                        start: {
                            character: 20,
                            line: 4,
                        },
                    },
                },
            ]);
        }

        it(`Rename one in-expression identifier`, async () =>
            await renameOneIdentifier(
                `let
                    _message = if (message <> null) then message else "(no message)",
                    #"message 1#" = if (message <> null) then message else "(no message 1)",
                    #"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",
                    a = "Hello from ThirdPQConn: " & #"message 3#"
                in
                    a|`,
            ));

        it(`Rename one in-expression identifier from left`, async () =>
            await renameOneIdentifier(
                `let
                    _message = if (message <> null) then message else "(no message)",
                    #"message 1#" = if (message <> null) then message else "(no message 1)",
                    #"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",
                    a = "Hello from ThirdPQConn: " & #"message 3#"
                in
                    |a`,
            ));

        it(`Rename one constructor identifier`, async () =>
            await renameOneIdentifier(
                `let
                    _message = if (message <> null) then message else "(no message)",
                    #"message 1#" = if (message <> null) then message else "(no message 1)",
                    #"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",
                    a| = "Hello from ThirdPQConn: " & #"message 3#"
                in
                    a`,
            ));

        it(`Rename one constructor identifier from left`, async () =>
            await renameOneIdentifier(
                `let
                    _message = if (message <> null) then message else "(no message)",
                    #"message 1#" = if (message <> null) then message else "(no message 1)",
                    #"message 3#" = if (#"message 1#" <> null) then message else "(no message 1)",
                    |a = "Hello from ThirdPQConn: " & #"message 3#"
                in
                    a`,
            ));
    });

    describe("Rename generalized identifiers", () => {
        it(`Rename one record-expression identifier`, async () =>
            await runTest(
                `let
                    foo = 1,
                    bar = 1,
                    ThirdPQConn = [
                        Authentication = [
                            Implicit = [],
                            foo = foo|
                        ],
                        Label = Extension.LoadString("DataSourceLabel")
                    ]
                in
                    ThirdPQConn`,
                `foo1`,
                [
                    {
                        newText: "foo1",
                        range: {
                            end: {
                                character: 23,
                                line: 1,
                            },
                            start: {
                                character: 20,
                                line: 1,
                            },
                        },
                    },
                    {
                        newText: "foo1",
                        range: {
                            end: {
                                character: 37,
                                line: 6,
                            },
                            start: {
                                character: 34,
                                line: 6,
                            },
                        },
                    },
                ],
            ));

        it(`Rename one identifier in its paired assignment expression creator`, async () =>
            await runTest(
                `let
                    |foo = 1,
                    bar = 1,
                    ThirdPQConn = [
                        Authentication = [
                            Implicit = [],
                            foo = foo
                        ],
                        Label = Extension.LoadString("DataSourceLabel")
                    ]
                in
                    ThirdPQConn`,
                `foo2`,
                [
                    {
                        newText: "foo2",
                        range: {
                            end: {
                                character: 23,
                                line: 1,
                            },
                            start: {
                                character: 20,
                                line: 1,
                            },
                        },
                    },
                    {
                        newText: "foo2",
                        range: {
                            end: {
                                character: 37,
                                line: 6,
                            },
                            start: {
                                character: 34,
                                line: 6,
                            },
                        },
                    },
                ],
            ));

        it(`Rename one record-expression identifier creator`, async () => {
            await runTest(
                `let
                foo = 1,
                bar = 1,
                ThirdPQConn = [
                    Authentication = [
                        Implicit = [],
                        |foo = foo
                    ],
                    Label = Extension.LoadString("DataSourceLabel")
                ]
            in
                ThirdPQConn`,
                `foo2`,
                [
                    {
                        newText: "foo2",
                        range: {
                            end: {
                                character: 27,
                                line: 6,
                            },
                            start: {
                                character: 24,
                                line: 6,
                            },
                        },
                    },
                ],
            );
        });

        it(`Rename one identifier within a statement`, async () => {
            await runTest(
                `let
                    foo| = 1,
                    bar = 1,
                    ThirdPQConn = [
                        Authentication = [
                            Implicit = [],
                            foo = foo
                        ],
                        Label = Extension.LoadString("DataSourceLabel")
                    ]
                in
                    ThirdPQConn`,
                `foo3`,
                [
                    {
                        newText: "foo3",
                        range: {
                            end: {
                                character: 23,
                                line: 1,
                            },
                            start: {
                                character: 20,
                                line: 1,
                            },
                        },
                    },
                    {
                        newText: "foo3",
                        range: {
                            end: {
                                character: 37,
                                line: 6,
                            },
                            start: {
                                character: 34,
                                line: 6,
                            },
                        },
                    },
                ],
            );
        });

        it(`Rename one generalized identifier within a statement with constant at symbol`, async () => {
            await runTest(
                `let
                    foo = 1,
                    bar = 1,
                    ThirdPQConn = [
                        Authentication = [
                            |Implicit = [],
                            foo = @Implicit
                        ],
                        Label = Extension.LoadString("DataSourceLabel")
                    ]
                in
                    ThirdPQConn`,
                "Implicit4",
                [
                    {
                        newText: "Implicit4",
                        range: {
                            end: {
                                character: 36,
                                line: 5,
                            },
                            start: {
                                character: 28,
                                line: 5,
                            },
                        },
                    },
                    {
                        newText: "Implicit4",
                        range: {
                            end: {
                                character: 43,
                                line: 6,
                            },
                            start: {
                                character: 35,
                                line: 6,
                            },
                        },
                    },
                ],
            );
        });

        it(`Rename one referred generalized identifier within a statement with constant at symbol`, async () => {
            await runTest(
                `let
                    foo = 1,
                    bar = 1,
                    ThirdPQConn = [
                        Authentication = [
                            Implicit = [],
                            foo = @Implicit|
                        ],
                        Label = Extension.LoadString("DataSourceLabel")
                    ]
                in
                    ThirdPQConn`,
                "Implicit4",
                [
                    {
                        newText: "Implicit4",
                        range: {
                            end: {
                                character: 36,
                                line: 5,
                            },
                            start: {
                                character: 28,
                                line: 5,
                            },
                        },
                    },
                    {
                        newText: "Implicit4",
                        range: {
                            end: {
                                character: 43,
                                line: 6,
                            },
                            start: {
                                character: 35,
                                line: 6,
                            },
                        },
                    },
                ],
            );
        });
    });
});

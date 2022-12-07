// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ICancellationToken } from "@microsoft/powerquery-parser";
import { Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import {
    AnalysisSettings,
    CompletionItemKind,
    Inspection,
    InspectionSettings,
    Library,
    LibraryUtils,
    TypeStrategy,
    ValidationSettings,
} from "../powerquery-language-services";

export class NoOpCancellationToken implements ICancellationToken {
    isCancelled: () => boolean = () => false;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    throwIfCancelled: () => void = () => {};
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    cancel: () => void = () => {};
}

export const enum TestLibraryName {
    CreateFooAndBarRecord = "Test.CreateFooAndBarRecord",
    CombineNumberAndOptionalText = "Test.CombineNumberAndOptionalText",
    DuplicateText = "Test.DuplicateText",
    Number = "Test.Number",
    NumberOne = "Test.NumberOne",
    SquareIfNumber = "Test.SquareIfNumber",
}

export const NoOpCancellationTokenInstance: NoOpCancellationToken = new NoOpCancellationToken();

export const DefaultInspectionSettings: InspectionSettings = {
    ...PQP.DefaultSettings,
    isWorkspaceCacheAllowed: false,
    library: Library.NoOpLibrary,
    eachScopeById: undefined,
    typeStrategy: TypeStrategy.Extended,
};

export const CreateFooAndBarRecordDefinedFunction: Type.DefinedFunction = TypeUtils.createDefinedFunction(
    false,
    [],
    TypeUtils.createDefinedRecord(
        false,
        new Map<string, Type.TPowerQueryType>([
            ["foo", TypeUtils.createTextLiteral(false, `"fooString"`)],
            ["bar", TypeUtils.createTextLiteral(false, `"barString"`)],
        ]),
        false,
    ),
);

export const CombineNumberAndOptionalTextDefinedFunction: Type.DefinedFunction = TypeUtils.createDefinedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            nameLiteral: "firstArg",
            type: Type.TypeKind.Number,
        },
        {
            isNullable: false,
            isOptional: true,
            nameLiteral: "secondArg",
            type: Type.TypeKind.Text,
        },
    ],
    Type.NullInstance,
);

export const SquareIfNumberDefinedFunction: Type.DefinedFunction = TypeUtils.createDefinedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            type: undefined,
            nameLiteral: "x",
        },
    ],
    Type.AnyInstance,
);

export const DuplicateTextDefinedFunction: Type.DefinedFunction = TypeUtils.createDefinedFunction(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            type: Type.TypeKind.Text,
            nameLiteral: "txt",
        },
    ],
    Type.TextInstance,
);

export const SimpleLibraryDefinitions: Library.LibraryDefinitions = new Map<string, Library.TLibraryDefinition>([
    [
        TestLibraryName.CreateFooAndBarRecord,
        LibraryUtils.createFunctionDefinition(
            TestLibraryName.CreateFooAndBarRecord,
            `The name is ${TestLibraryName.CreateFooAndBarRecord}`,
            CreateFooAndBarRecordDefinedFunction,
            CompletionItemKind.Function,
            [],
        ),
    ],
    [
        TestLibraryName.Number,
        LibraryUtils.createConstantDefinition(
            TestLibraryName.Number,
            `The name is ${TestLibraryName.Number}`,
            Type.NumberInstance,
            CompletionItemKind.Value,
        ),
    ],
    [
        TestLibraryName.CombineNumberAndOptionalText,
        LibraryUtils.createFunctionDefinition(
            TestLibraryName.CombineNumberAndOptionalText,
            `The name is ${TestLibraryName.CombineNumberAndOptionalText}`,
            CombineNumberAndOptionalTextDefinedFunction,
            CompletionItemKind.Function,
            [
                {
                    isNullable: false,
                    isOptional: false,
                    label: "firstArg",
                    documentation: undefined,
                    typeKind: Type.TypeKind.Number,
                },
                {
                    isNullable: false,
                    isOptional: true,
                    label: "secondArg",
                    documentation: undefined,
                    typeKind: Type.TypeKind.Text,
                },
            ],
        ),
    ],
    [
        TestLibraryName.NumberOne,
        LibraryUtils.createConstantDefinition(
            TestLibraryName.NumberOne,
            `The name is ${TestLibraryName.NumberOne}`,
            TypeUtils.createNumberLiteral(false, "1"),
            CompletionItemKind.Constant,
        ),
    ],
    [
        TestLibraryName.SquareIfNumber,
        LibraryUtils.createFunctionDefinition(
            TestLibraryName.SquareIfNumber,
            `The name is ${TestLibraryName.SquareIfNumber}`,
            SquareIfNumberDefinedFunction,
            CompletionItemKind.Function,
            [
                {
                    isNullable: false,
                    isOptional: false,
                    label: "x",
                    documentation:
                        "If the argument is a number then multiply it by itself, otherwise return argument as-is.",
                    typeKind: Type.TypeKind.Any,
                },
            ],
        ),
    ],
]);

export const SimpleExternalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn = (
    request: Inspection.ExternalType.TExternalTypeRequest,
) => {
    switch (request.kind) {
        case Inspection.ExternalType.ExternalTypeRequestKind.Invocation:
            switch (request.identifierLiteral) {
                case TestLibraryName.SquareIfNumber: {
                    if (request.args.length !== 1) {
                        return Type.NoneInstance;
                    }

                    const arg: Type.TPowerQueryType = Assert.asDefined(request.args[0]);

                    if (TypeUtils.isNumberLiteral(arg)) {
                        const newNormalizedLiteral: number = arg.normalizedLiteral * arg.normalizedLiteral;

                        return {
                            ...arg,
                            literal: newNormalizedLiteral.toString(),
                            normalizedLiteral: newNormalizedLiteral,
                        };
                    } else if (TypeUtils.isNumber(arg)) {
                        return Type.NumberInstance;
                    } else {
                        return Type.AnyInstance;
                    }
                }

                default:
                    return undefined;
            }

        case Inspection.ExternalType.ExternalTypeRequestKind.Value:
            switch (request.identifierLiteral) {
                case TestLibraryName.CreateFooAndBarRecord:
                    return CreateFooAndBarRecordDefinedFunction;

                case TestLibraryName.CombineNumberAndOptionalText:
                    return CombineNumberAndOptionalTextDefinedFunction;

                case TestLibraryName.DuplicateText:
                    return DuplicateTextDefinedFunction;

                case TestLibraryName.Number:
                    return Type.NumberInstance;

                case TestLibraryName.NumberOne:
                    return TypeUtils.createNumberLiteral(false, "1");

                case TestLibraryName.SquareIfNumber:
                    return SquareIfNumberDefinedFunction;

                default:
                    return undefined;
            }

        default:
            throw Assert.isNever(request);
    }
};

export const SimpleLibrary: Library.ILibrary = {
    externalTypeResolver: SimpleExternalTypeResolver,
    libraryDefinitions: SimpleLibraryDefinitions,
};

export const SimpleInspectionSettings: InspectionSettings = {
    ...DefaultInspectionSettings,
    library: SimpleLibrary,
};

export const SimpleLibraryAnalysisSettings: AnalysisSettings = {
    isWorkspaceCacheAllowed: false,
    initialCorrelationId: undefined,
    traceManager: NoOpTraceManagerInstance,
    inspectionSettings: SimpleInspectionSettings,
};

export const SimpleValidateAllSettings: ValidationSettings = {
    ...SimpleInspectionSettings,
    checkForDuplicateIdentifiers: true,
    checkInvokeExpressions: true,
    checkUnknownIdentifiers: true,
    library: SimpleLibrary,
    source: "UNIT-TEST-SOURCE",
};

export const SimpleValidateNoneSettings: ValidationSettings = {
    ...SimpleInspectionSettings,
    checkForDuplicateIdentifiers: false,
    checkInvokeExpressions: false,
    checkUnknownIdentifiers: false,
    library: SimpleLibrary,
    source: "UNIT-TEST-SOURCE",
};

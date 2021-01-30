// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import * as Library from "./library";

import { FunctionName } from "./functionName";

export function externalTypeResolverFnFactory(
    library: Library.Library,
): PQP.Language.ExternalType.TExternalTypeResolverFn {
    const libraryMap: LibraryMap = createLibraryMap(library);

    return (request: PQP.Language.ExternalType.TExternalTypeRequest) => {
        const identifierLiteral: string = request.identifierLiteral;

        const maybeExteranlTypeTrio: TExternalTypeTrio | undefined = libraryMap.get(identifierLiteral);
        if (maybeExteranlTypeTrio === undefined) {
            return undefined;
        }
        const externalTypeTrio: TExternalTypeTrio = maybeExteranlTypeTrio;
        const value: PQP.Language.Type.TType = externalTypeTrio.value;

        switch (request.kind) {
            case PQP.Language.ExternalType.ExternalTypeRequestKind.Invocation:
                return externalTypeTrio.kind === ExternalTypeTrioKind.Invocation
                    ? externalTypeTrio.invocationResolverFn(request)
                    : undefined;

            case PQP.Language.ExternalType.ExternalTypeRequestKind.Value:
                return value;

            default:
                throw PQP.Assert.isNever(request);
        }
    };
}

function createLibraryMap(library: Library.Library): LibraryMap {
    const result: Map<string, TExternalTypeTrio> = new Map();

    for (const exteranlTypeTrio of ExternalTypeTrios) {
        if (isExternalTypeTrioIncluded(library, exteranlTypeTrio)) {
            result.set(exteranlTypeTrio.identifierLiteral, exteranlTypeTrio);
        }
    }

    return result;
}

function isExternalTypeTrioIncluded(library: Library.Library, externalTypeTrio: TExternalTypeTrio): boolean {
    return library.has(externalTypeTrio.identifierLiteral);
}

function resolveTableAddColumn(
    _request: PQP.Language.ExternalType.ExternalInvocationTypeRequest,
): PQP.Language.Type.TType | undefined {
    return undefined;
}

type LibraryMap = Map<string, TExternalTypeTrio>;

type TExternalTypeTrio = ExteranlInvocationTrio | ExteranlValueTrio;

const enum ExternalTypeTrioKind {
    Invocation = "Invocation",
    Value = "Value",
}

interface IExternalTypeTrio {
    readonly kind: ExternalTypeTrioKind;
    readonly identifierLiteral: string;
    readonly value: PQP.Language.Type.TType;
}

interface ExteranlInvocationTrio extends IExternalTypeTrio {
    readonly kind: ExternalTypeTrioKind.Invocation;
    readonly invocationResolverFn: (
        request: PQP.Language.ExternalType.ExternalInvocationTypeRequest,
    ) => PQP.Language.Type.TType | undefined;
}

interface ExteranlValueTrio extends IExternalTypeTrio {
    readonly kind: ExternalTypeTrioKind.Value;
}

const TableAddColumnType: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.definedFunctionFactory(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            maybeType: PQP.Language.Type.TypeKind.Table,
            nameLiteral: "table",
        },
        {
            isNullable: false,
            isOptional: false,
            maybeType: PQP.Language.Type.TypeKind.Text,
            nameLiteral: "newColumnName",
        },
        {
            isNullable: false,
            isOptional: false,
            maybeType: PQP.Language.Type.TypeKind.Function,
            nameLiteral: "columnGenerator",
        },
        {
            isNullable: true,
            isOptional: true,
            maybeType: PQP.Language.Type.TypeKind.Type,
            nameLiteral: "type",
        },
    ],
    PQP.Language.Type.TableInstance,
);

const ExternalTypeTrios: ReadonlyArray<TExternalTypeTrio> = [
    {
        kind: ExternalTypeTrioKind.Invocation,
        identifierLiteral: FunctionName.TableAddColumn,
        value: TableAddColumnType,
        invocationResolverFn: resolveTableAddColumn,
    },
];

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ExternalType, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Library, LibraryDefinition } from "../library";
import { FunctionName } from "../functionName";

export function externalTypeResolverFnFactory(
    library: Library,
): ExternalType.TExternalTypeResolverFn {
    const mappings: 
}

function createLibraryMap(library: Library): LibraryMap {
    for ([x, y, z] of ExternalTypeTrios) {

    }
}



interface LibraryMap {
    readonly value: ReadonlyMap<FunctionName, Type.TType>;
    readonly invocation: ReadonlyMap<FunctionName, ExternalType.TExternalTypeResolverFn>
}

interface ExternalTypeTrio {
    readonly identifierLiteral: string,
    readonly value: Type.TType | undefined,
    readonly invocationFn: (request: ExternalType.ExternalInvocationTypeRequest) => Type.TType | undefined,
}

const TableAddColumnType: Type.TType = TypeUtils.functionTypeFactory(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            maybeType: Type.TypeKind.Table,
            nameLiteral: "table",
        },
        {
            isNullable: false,
            isOptional: false,
            maybeType: Type.TypeKind.Text,
            nameLiteral: "newColumnName",
        },
        {
            isNullable: false,
            isOptional: false,
            maybeType: Type.TypeKind.Function,
            nameLiteral: "columnGenerator",
        },
        {
            isNullable: true,
            isOptional: true,
            maybeType: Type.TypeKind.Type,
            nameLiteral: "type",
        },
    ],
    Type.TableInstance,
);

function tableAddColumnInvocation(request: ExternalType.ExternalInvocationTypeRequest, functionType: Type.FunctionType): Type.TType | undefined {
    request.args
}

function functionArgumentsMatch(requestArgs: ReadonlyArray<Type.TType>, functionType: Type.FunctionType): boolean {
    // You can't provide more arguments than are on the function signature.
    if (requestArgs.length > functionType.parameters.length) {
        return false;
    }

    const parameters: ReadonlyArray<Type.TType> = functionType.parameters;
    const numParameters: number = functionType.parameters;
    for (let index: number = 1; index < numParameters; index += 1) {
        const functionTypeArg = functioNT
    }

    if (TypeUtils.isCompatible())

}

const ExternalTypeTrios: ReadonlyArray<ExternalTypeTrio> = [
    
        {
            identifierLiteral: FunctionName.TableAddColumn,
            value: TableAddColumnType,
            invocationFn: tableAddColumnInvocation,
        }
    ]

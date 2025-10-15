// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, type ErrorResult, type Result, ResultUtils } from "@microsoft/powerquery-parser";
import { Constant, ConstantUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { type ExternalType, ExternalTypeUtils } from "../externalType";
import { Library, LibraryDefinitionUtils } from "../library";
import { type LibrarySymbol, type LibrarySymbolFunctionParameter } from "./librarySymbol";
import { CompletionItemKind } from "../commonTypes";

// Created when non-zero conversion errors occur.
export interface IncompleteLibrary {
    readonly library: Library.ILibrary;
    readonly failedLibrarySymbolConversions: ReadonlyArray<FailedLibrarySymbolConversion>;
}

export interface IncompleteLibraryDefinitions {
    readonly libraryDefinitions: ReadonlyMap<string, Library.TLibraryDefinition>;
    readonly failedLibrarySymbolConversions: ReadonlyArray<FailedLibrarySymbolConversion>;
}

export interface FailedLibrarySymbolConversion {
    readonly librarySymbol: LibrarySymbol;
    readonly kind: FailedLibrarySymbolConversionKind;
}

export interface FailedLibrarySymbolParameterConversion extends FailedLibrarySymbolConversion {
    readonly kind: FailedLibrarySymbolConversionKind.Parameter;
    readonly index: number;
}

export enum FailedLibrarySymbolConversionKind {
    CompletionItemKind = "CompletionItemKind",
    DefinedFunction = "DefinedFunction",
    Parameter = "Parameter",
    PrimitiveType = "PrimitiveType",
}

/**
    Always returns a library, even if there are failed library symbol conversions.
    An Ok result indicates that all library symbols were successfully converted.
    An Error result indicates that some library symbols failed to convert.
*/
export function createLibrary(
    librarySymbols: ReadonlyArray<LibrarySymbol>,
    dynamicLibraryDefinitions: () => ReadonlyMap<string, Library.TLibraryDefinition>,
    externalTypeResolverFn: ExternalType.TExternalTypeResolverFn | undefined,
): Result<Library.ILibrary, IncompleteLibrary> {
    const libraryDefinitionsResult: Result<
        ReadonlyMap<string, Library.TLibraryDefinition>,
        IncompleteLibraryDefinitions
    > = createLibraryDefinitions(librarySymbols);

    let staticLibraryDefinitions: ReadonlyMap<string, Library.TLibraryDefinition>;
    let failedLibrarySymbolConversions: ReadonlyArray<FailedLibrarySymbolConversion>;

    if (ResultUtils.isOk(libraryDefinitionsResult)) {
        staticLibraryDefinitions = libraryDefinitionsResult.value;
        failedLibrarySymbolConversions = [];
    } else {
        staticLibraryDefinitions = libraryDefinitionsResult.error.libraryDefinitions;
        failedLibrarySymbolConversions = libraryDefinitionsResult.error.failedLibrarySymbolConversions;
    }

    const libraryDefinitions: Library.LibraryDefinitions = {
        dynamicLibraryDefinitions,
        staticLibraryDefinitions,
    };

    const definitionResolverFn: ExternalType.TExternalTypeResolverFn =
        LibraryDefinitionUtils.externalTypeResolver(libraryDefinitions);

    const library: Library.ILibrary = {
        externalTypeResolver: externalTypeResolverFn
            ? ExternalTypeUtils.composeExternalTypeResolvers(externalTypeResolverFn, definitionResolverFn)
            : definitionResolverFn,
        libraryDefinitions,
    };

    if (failedLibrarySymbolConversions.length > 0) {
        return ResultUtils.error({
            library,
            failedLibrarySymbolConversions,
        });
    } else {
        return ResultUtils.ok(library);
    }
}

export function createLibraryDefinition(
    librarySymbol: LibrarySymbol,
): Result<Library.TLibraryDefinition, FailedLibrarySymbolConversion> {
    const primitiveType: Type.TPrimitiveType | undefined = stringToPrimitiveType(librarySymbol.type);

    const completionItemKind: CompletionItemKind | undefined = numberToCompletionItemKind(
        librarySymbol.completionItemKind,
    );

    if (primitiveType === undefined) {
        return failedConversionError(librarySymbol, FailedLibrarySymbolConversionKind.PrimitiveType);
    }

    if (completionItemKind === undefined) {
        return failedConversionError(librarySymbol, FailedLibrarySymbolConversionKind.CompletionItemKind);
    }

    const label: string = librarySymbol.name;
    const description: string = librarySymbol.documentation?.description ?? "No description available";

    if (primitiveType.kind === Type.TypeKind.Type) {
        return ResultUtils.ok({
            kind: Library.LibraryDefinitionKind.Type,
            label,
            description,
            asPowerQueryType: primitiveType,
            completionItemKind,
        });
    } else if (librarySymbol.functionParameters) {
        const definedFunction: Type.DefinedFunction | undefined = librarySymbolFunctionParamatersToDefinedFunction(
            librarySymbol,
            primitiveType,
        );

        if (definedFunction === undefined) {
            return failedConversionError(librarySymbol, FailedLibrarySymbolConversionKind.DefinedFunction);
        }

        const parameters: Library.LibraryParameter[] = [];

        for (const [parameter, index] of ArrayUtils.enumerate(librarySymbol.functionParameters)) {
            const libraryParameter: Library.LibraryParameter | undefined =
                librarySymbolFunctionParameterToLibraryParameter(parameter);

            if (libraryParameter === undefined) {
                return failedParameterConversionError(librarySymbol, index);
            }

            parameters.push(libraryParameter);
        }

        return ResultUtils.ok({
            kind: Library.LibraryDefinitionKind.Function,
            label: TypeUtils.nameOf(definedFunction, NoOpTraceManagerInstance, undefined),
            description,
            asPowerQueryType: definedFunction,
            completionItemKind,
            parameters,
        });
    } else {
        return ResultUtils.ok({
            kind: Library.LibraryDefinitionKind.Constant,
            label,
            description,
            asPowerQueryType: primitiveType,
            completionItemKind,
        });
    }
}

export function createLibraryDefinitions(
    librarySymbols: ReadonlyArray<LibrarySymbol>,
): Result<ReadonlyMap<string, Library.TLibraryDefinition>, IncompleteLibraryDefinitions> {
    const libraryDefinitions: Map<string, Library.TLibraryDefinition> = new Map<string, Library.TLibraryDefinition>();
    const failedLibrarySymbolConversions: FailedLibrarySymbolConversion[] = [];

    for (const librarySymbol of librarySymbols) {
        const libraryDefinitionResult: Result<Library.TLibraryDefinition, FailedLibrarySymbolConversion> =
            createLibraryDefinition(librarySymbol);

        if (ResultUtils.isOk(libraryDefinitionResult)) {
            libraryDefinitions.set(librarySymbol.name, libraryDefinitionResult.value);
        } else {
            failedLibrarySymbolConversions.push(libraryDefinitionResult.error);
        }
    }

    if (failedLibrarySymbolConversions.length === 0) {
        return ResultUtils.ok(libraryDefinitions);
    } else {
        return ResultUtils.error({
            libraryDefinitions,
            failedLibrarySymbolConversions,
        });
    }
}

function failedConversionError(
    librarySymbol: LibrarySymbol,
    kind: FailedLibrarySymbolConversionKind,
): ErrorResult<FailedLibrarySymbolConversion> {
    return ResultUtils.error({
        librarySymbol,
        kind,
    });
}

function failedParameterConversionError(
    librarySymbol: LibrarySymbol,
    index: number,
): ErrorResult<FailedLibrarySymbolParameterConversion> {
    return ResultUtils.error({
        librarySymbol,
        kind: FailedLibrarySymbolConversionKind.Parameter,
        index,
    });
}

function librarySymbolFunctionParamatersToDefinedFunction(
    librarySymbol: LibrarySymbol,
    returnType: Type.TPrimitiveType,
): Type.DefinedFunction | undefined {
    const parameters: Type.FunctionParameter[] = [];

    for (const parameter of librarySymbol.functionParameters ?? []) {
        const primitiveType: Type.TPrimitiveType | undefined = stringToPrimitiveType(parameter.type);

        if (primitiveType === undefined) {
            return undefined;
        }

        parameters.push({
            isNullable: primitiveType.isNullable,
            isOptional: !parameter.isRequired,
            type: primitiveType.kind,
            nameLiteral: parameter.name,
        });
    }

    return TypeUtils.definedFunction(false, parameters, returnType);
}

function librarySymbolFunctionParameterToLibraryParameter(
    parameter: LibrarySymbolFunctionParameter,
): Library.LibraryParameter | undefined {
    const primitiveType: Type.TPrimitiveType | undefined = stringToPrimitiveType(parameter.type);

    if (primitiveType === undefined) {
        return undefined;
    }

    return {
        isNullable: primitiveType.isNullable,
        isOptional: false,
        label: parameter.name,
        documentation: parameter.description ?? undefined,
        typeKind: primitiveType.kind,
    };
}

function numberToCompletionItemKind(variant: number): CompletionItemKind | undefined {
    switch (variant) {
        case CompletionItemKind.Constant:
        case CompletionItemKind.Constructor:
        case CompletionItemKind.Enum:
        case CompletionItemKind.EnumMember:
        case CompletionItemKind.Event:
        case CompletionItemKind.Field:
        case CompletionItemKind.File:
        case CompletionItemKind.Folder:
        case CompletionItemKind.Function:
        case CompletionItemKind.Interface:
        case CompletionItemKind.Keyword:
        case CompletionItemKind.Method:
        case CompletionItemKind.Module:
        case CompletionItemKind.Operator:
        case CompletionItemKind.Property:
        case CompletionItemKind.Reference:
        case CompletionItemKind.Snippet:
        case CompletionItemKind.Struct:
        case CompletionItemKind.Text:
        case CompletionItemKind.TypeParameter:
        case CompletionItemKind.Unit:
        case CompletionItemKind.Value:
        case CompletionItemKind.Variable:
            return variant;

        default:
            return undefined;
    }
}

// Depending on which path we took to generate the symbols parameters that are lists will have one of two forms:
// 1. `list`
// 2. `list {$typeKind}`
// To make my life easier I'm going to allow both forms at this layer,
// and then normalize both forms to `list`.
function stringToPrimitiveType(text: string): Type.TPrimitiveType | undefined {
    const split: ReadonlyArray<string> = text.split(" ");

    let isNullable: boolean;
    let typeKind: Type.TypeKind | undefined;

    switch (split.length) {
        case 0:
            return undefined;

        case 1: {
            isNullable = false;
            typeKind = stringToTypeKind(text);
            break;
        }

        // Either `nullable $typeKind` or `list {$typeKind}`
        case 2: {
            const first: string = split[0];

            if (first === Constant.LanguageConstant.Nullable) {
                isNullable = true;
                typeKind = stringToTypeKind(split[1]);

                break;
            } else if (first === Constant.PrimitiveTypeConstant.List) {
                isNullable = false;
                typeKind = Type.TypeKind.List;

                break;
            } else {
                return undefined;
            }
        }

        // `nullable list {$typeKind}`
        case 3: {
            if (split[0] !== Constant.LanguageConstant.Nullable || split[1] !== Constant.PrimitiveTypeConstant.List) {
                return undefined;
            }

            isNullable = true;
            typeKind = Type.TypeKind.List;

            break;
        }

        default:
            return undefined;
    }

    return typeKind ? TypeUtils.primitiveType(isNullable, typeKind) : undefined;
}

function stringToTypeKind(text: string): Type.TypeKind | undefined {
    return ConstantUtils.isPrimitiveTypeConstant(text)
        ? TypeUtils.typeKindFromPrimitiveTypeConstantKind(text)
        : undefined;
}

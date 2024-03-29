// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, PartialResult, PartialResultUtils } from "@microsoft/powerquery-parser";
import { Constant, ConstantUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ExternalType, ExternalTypeUtils } from "../externalType";
import { Library, LibraryDefinitionUtils } from "../library";
import { LibrarySymbol, LibrarySymbolFunctionParameter } from "./librarySymbol";
import { CompletionItemKind } from "../commonTypes";

export type IncompleteLibrary = {
    readonly library: Library.ILibrary;
    readonly invalidSymbols: ReadonlyArray<LibrarySymbol>;
};

export type IncompleteLibraryDefinitions = {
    readonly libraryDefinitions: ReadonlyMap<string, Library.TLibraryDefinition>;
    readonly invalidSymbols: ReadonlyArray<LibrarySymbol>;
};

export function createLibrary(
    librarySymbols: ReadonlyArray<LibrarySymbol>,
    dynamicLibraryDefinitions: () => ReadonlyMap<string, Library.TLibraryDefinition>,
    externalTypeResolverFn: ExternalType.TExternalTypeResolverFn | undefined,
): PartialResult<Library.ILibrary, IncompleteLibrary, ReadonlyArray<LibrarySymbol>> {
    const libraryDefinitionsResult: PartialResult<
        ReadonlyMap<string, Library.TLibraryDefinition>,
        IncompleteLibraryDefinitions,
        ReadonlyArray<LibrarySymbol>
    > = createLibraryDefinitions(librarySymbols);

    let librarySymbolDefinitions: ReadonlyMap<string, Library.TLibraryDefinition>;
    let invalidSymbols: ReadonlyArray<LibrarySymbol>;

    if (PartialResultUtils.isOk(libraryDefinitionsResult)) {
        librarySymbolDefinitions = libraryDefinitionsResult.value;
        invalidSymbols = [];
    } else if (PartialResultUtils.isIncomplete(libraryDefinitionsResult)) {
        librarySymbolDefinitions = libraryDefinitionsResult.partial.libraryDefinitions;
        invalidSymbols = libraryDefinitionsResult.partial.invalidSymbols;
    } else if (PartialResultUtils.isError(libraryDefinitionsResult)) {
        return PartialResultUtils.error(libraryDefinitionsResult.error);
    } else {
        Assert.isNever(libraryDefinitionsResult);
    }

    const libraryDefinitions: Library.LibraryDefinitions = {
        dynamicLibraryDefinitions,
        staticLibraryDefinitions: librarySymbolDefinitions,
    };

    const definitionResolverFn: ExternalType.TExternalTypeResolverFn =
        LibraryDefinitionUtils.externalTypeResolver(libraryDefinitions);

    const library: Library.ILibrary = {
        externalTypeResolver: externalTypeResolverFn
            ? ExternalTypeUtils.composeExternalTypeResolvers(externalTypeResolverFn, definitionResolverFn)
            : definitionResolverFn,
        libraryDefinitions,
    };

    if (invalidSymbols.length > 0) {
        return PartialResultUtils.incomplete({
            library,
            invalidSymbols,
        });
    } else {
        return PartialResultUtils.ok(library);
    }
}

export function createLibraryDefinitions(
    librarySymbols: ReadonlyArray<LibrarySymbol>,
): PartialResult<
    ReadonlyMap<string, Library.TLibraryDefinition>,
    IncompleteLibraryDefinitions,
    ReadonlyArray<LibrarySymbol>
> {
    const libraryDefinitions: Map<string, Library.TLibraryDefinition> = new Map<string, Library.TLibraryDefinition>();
    const invalidSymbols: LibrarySymbol[] = [];

    for (const librarySymbol of librarySymbols) {
        const libraryDefinition: Library.TLibraryDefinition | undefined =
            librarySymbolToLibraryDefinition(librarySymbol);

        if (libraryDefinition === undefined) {
            invalidSymbols.push(librarySymbol);
        } else {
            libraryDefinitions.set(librarySymbol.name, libraryDefinition);
        }
    }

    if (invalidSymbols.length === 0) {
        return PartialResultUtils.ok(libraryDefinitions);
    } else if (libraryDefinitions.size > 0) {
        return PartialResultUtils.incomplete({
            libraryDefinitions,
            invalidSymbols,
        });
    } else {
        return PartialResultUtils.error(invalidSymbols);
    }
}

export function librarySymbolToLibraryDefinition(librarySymbol: LibrarySymbol): Library.TLibraryDefinition | undefined {
    const primitiveType: Type.TPrimitiveType | undefined = stringToPrimitiveType(librarySymbol.type);

    const completionItemKind: CompletionItemKind | undefined = numberToCompletionItemKind(
        librarySymbol.completionItemKind,
    );

    if (primitiveType === undefined || completionItemKind === undefined) {
        return undefined;
    }

    const label: string = librarySymbol.name;
    const description: string = librarySymbol.documentation?.description ?? "No description available";

    if (primitiveType.kind === Type.TypeKind.Type) {
        return {
            kind: Library.LibraryDefinitionKind.Type,
            label,
            description,
            asPowerQueryType: primitiveType,
            completionItemKind,
        };
    } else if (librarySymbol.functionParameters) {
        const asPowerQueryType: Type.DefinedFunction | undefined = librarySymbolFunctionSignatureToType(
            librarySymbol,
            primitiveType,
        );

        if (asPowerQueryType === undefined) {
            return undefined;
        }

        const parameters: Library.LibraryParameter[] = [];

        for (const parameter of librarySymbol.functionParameters) {
            const libraryParameter: Library.LibraryParameter | undefined =
                librarySymbolFunctionParameterToLibraryParameter(parameter);

            if (libraryParameter === undefined) {
                return undefined;
            }

            parameters.push(libraryParameter);
        }

        return {
            kind: Library.LibraryDefinitionKind.Function,
            label: TypeUtils.nameOf(asPowerQueryType, NoOpTraceManagerInstance, undefined),
            description,
            asPowerQueryType,
            completionItemKind,
            parameters,
        };
    } else {
        return {
            kind: Library.LibraryDefinitionKind.Constant,
            label,
            description,
            asPowerQueryType: primitiveType,
            completionItemKind,
        };
    }
}

function librarySymbolFunctionSignatureToType(
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

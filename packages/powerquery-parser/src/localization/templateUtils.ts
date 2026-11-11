// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { l10nJsonFormat, l10nJsonMessageFormat } from "@vscode/l10n";

export function createTemplates<T extends Record<string, string>>(
    defaults: T,
    bundle: l10nJsonFormat,
): { [K in keyof T]: string } {
    const templates: { [K in keyof T]: string } = { ...defaults };

    for (const key in templates) {
        const message: string = templates[key];
        const translation: l10nJsonMessageFormat | undefined = bundle[message];
        templates[key] = typeof translation === "string" ? translation : (translation?.message ?? message);
    }

    return templates;
}

export function createLazyTemplates<T extends Record<string, string>>(
    defaults: T,
    loadBundle: () => l10nJsonFormat,
): { [K in keyof T]: string } {
    type Templates = { [K in keyof T]: string };
    const target: Partial<Templates> = {};
    let initialized: boolean = false;

    function initialize(): void {
        if (!initialized) {
            Object.assign(target, createTemplates(defaults, loadBundle()));
            initialized = true;
        }
    }

    const proxy: Partial<Templates> = new Proxy(target, {
        get: (target: Partial<Templates>, property: string | symbol, receiver: unknown): unknown => {
            initialize();

            return Reflect.get(target, property, receiver);
        },
        set: (target: Partial<Templates>, property: string | symbol, value: unknown, receiver: unknown): boolean => {
            initialize();

            return Reflect.set(target, property, value, receiver);
        },
        has: (target: Partial<Templates>, property: string | symbol): boolean => {
            initialize();

            return Reflect.has(target, property);
        },
        ownKeys: (target: Partial<Templates>): ArrayLike<string | symbol> => {
            initialize();

            return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor: (
            target: Partial<Templates>,
            property: string | symbol,
        ): PropertyDescriptor | undefined => {
            initialize();

            return Reflect.getOwnPropertyDescriptor(target, property);
        },
        defineProperty: (
            target: Partial<Templates>,
            property: string | symbol,
            descriptor: PropertyDescriptor,
        ): boolean => {
            initialize();

            return Reflect.defineProperty(target, property, descriptor);
        },
        deleteProperty: (target: Partial<Templates>, property: string | symbol): boolean => {
            initialize();

            return Reflect.deleteProperty(target, property);
        },
        preventExtensions: (target: Partial<Templates>): boolean => {
            initialize();

            return Reflect.preventExtensions(target);
        },
        setPrototypeOf: (target: Partial<Templates>, prototype: object | null): boolean => {
            initialize();

            return Reflect.setPrototypeOf(target, prototype);
        },
    });

    // Every observable property operation materializes the complete mapped record first.
    return proxy as Templates;
}

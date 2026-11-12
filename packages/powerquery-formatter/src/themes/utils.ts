// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export function strcmp(a: string, b: string): number {
    if (a < b) {
        return -1;
    }

    if (a > b) {
        return 1;
    }

    return 0;
}

export function strArrCmp(a: string[] | undefined, b: string[] | undefined): number {
    if (a === undefined && b === undefined) {
        return 0;
    }

    if (a === undefined) {
        return -1;
    }

    if (b === undefined) {
        return 1;
    }

    const len1: number = a.length;
    const len2: number = b.length;

    if (len1 === len2) {
        // eslint-disable-next-line no-plusplus
        for (let i: number = 0; i < len1; i++) {
            const res: number = strcmp(a[i], b[i]);

            if (res !== 0) {
                return res;
            }
        }

        return 0;
    }

    return len1 - len2;
}

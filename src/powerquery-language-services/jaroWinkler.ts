// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils } from "@microsoft/powerquery-parser";

// https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance

// The standard magic numbers for Winkler adjustments.
const WinklerAdjustment: number = 0.1;
const WinklerMaxCharacterAdjustment: number = 4;
const WinklerScoreThreshold: number = 0.7;

// Unknown-identifier validation compares many misspellings against the same library names.
// Keeping both forms lets it normalize each library name once without losing the spelling shown to users.
export interface PreparedJaroWinklerOption {
    readonly normalizedValue: string;
    readonly value: string;
}

export function calculateJaro(left: string, right: string): number {
    const normalizedLeft: string = left.toLowerCase();
    const normalizedRight: string = right.toLowerCase();
    const shorter: string = normalizedLeft.length < normalizedRight.length ? normalizedLeft : normalizedRight;
    const longer: string = normalizedLeft.length < normalizedRight.length ? normalizedRight : normalizedLeft;

    return calculateJaroForNormalized(shorter, longer);
}

export function calculateJaroWinkler(left: string, right: string): number {
    return calculateJaroWinklerForNormalized(left.toLowerCase(), right.toLowerCase());
}

export function prepareJaroWinklerOptions(options: ReadonlyArray<string>): ReadonlyArray<PreparedJaroWinklerOption> {
    return options.map((value: string) => ({
        normalizedValue: value.toLowerCase(),
        value,
    }));
}

export function calculateJaroWinklersWithPreparedOptions(
    source: string,
    options: ReadonlyArray<PreparedJaroWinklerOption>,
): [number, string] {
    ArrayUtils.assertNonZeroLength(options);

    const normalizedSource: string = source.toLowerCase();
    let maximumLength: number = normalizedSource.length;

    for (const option of options) {
        maximumLength = Math.max(maximumLength, option.normalizedValue.length);
    }

    const shorterMatches: Uint8Array = new Uint8Array(maximumLength);
    const longerMatches: Uint8Array = new Uint8Array(maximumLength);
    let bestScore: number = -1;
    let bestOption: string = "";

    for (const option of options) {
        const currentScore: number = calculateJaroWinklerForNormalized(
            normalizedSource,
            option.normalizedValue,
            shorterMatches,
            longerMatches,
        );

        if (currentScore > bestScore) {
            bestScore = currentScore;
            bestOption = option.value;
        }
    }

    return [bestScore, bestOption];
}

function calculateJaroWinklerForNormalized(
    normalizedLeft: string,
    normalizedRight: string,
    shorterMatches?: Uint8Array,
    longerMatches?: Uint8Array,
): number {
    const shorter: string = normalizedLeft.length < normalizedRight.length ? normalizedLeft : normalizedRight;
    const longer: string = normalizedLeft.length < normalizedRight.length ? normalizedRight : normalizedLeft;
    let jaroScore: number = calculateJaroForNormalized(shorter, longer, shorterMatches, longerMatches);

    if (jaroScore <= WinklerScoreThreshold) {
        return jaroScore;
    }

    // Adjust score for the number of leading characters that match.
    // Capped at an upper bound of N leading characters, where N is most commonly `4`.
    const upperBound: number = Math.max(WinklerMaxCharacterAdjustment, shorter.length);
    let startingCharIndex: number = 0;

    while (shorter[startingCharIndex] === longer[startingCharIndex] && startingCharIndex < upperBound) {
        startingCharIndex += 1;
    }

    if (startingCharIndex) {
        jaroScore += startingCharIndex * WinklerAdjustment * (1 - jaroScore);
    }

    return jaroScore;
}

// Returns [score, string] for the string with the highest jaro winkler score.
export function calculateJaroWinklers(source: string, options: ReadonlyArray<string>): [number, string] {
    ArrayUtils.assertNonZeroLength(options);

    const normalizedSource: string = source.toLowerCase();
    const normalizedOptions: string[] = new Array(options.length);
    let maximumLength: number = normalizedSource.length;

    for (let index: number = 0; index < options.length; index += 1) {
        const normalizedOption: string = options[index].toLowerCase();
        normalizedOptions[index] = normalizedOption;
        maximumLength = Math.max(maximumLength, normalizedOption.length);
    }

    const shorterMatches: Uint8Array = new Uint8Array(maximumLength);
    const longerMatches: Uint8Array = new Uint8Array(maximumLength);
    let bestScore: number = -1;
    let bestOption: string = "";

    for (let index: number = 0; index < options.length; index += 1) {
        const currentScore: number = calculateJaroWinklerForNormalized(
            normalizedSource,
            normalizedOptions[index],
            shorterMatches,
            longerMatches,
        );

        if (currentScore > bestScore) {
            bestScore = currentScore;
            bestOption = options[index];
        }
    }

    return [bestScore, bestOption];
}

function calculateJaroForNormalized(
    shorter: string,
    longer: string,
    reusableShorterMatches?: Uint8Array,
    reusableLongerMatches?: Uint8Array,
): number {
    const shorterLength: number = shorter.length;
    const longerLength: number = longer.length;
    // When trying to find similar characters limit the search to a window based on longer's length.
    const matchingWindowSize: number = Math.floor(longerLength / 2) - 1;

    const shorterMatches: Uint8Array = reusableShorterMatches ?? new Uint8Array(shorterLength);
    const longerMatches: Uint8Array = reusableLongerMatches ?? new Uint8Array(longerLength);
    // Bulk searches pass the same buffers to every comparison, so clear only the portions used by this pair.
    shorterMatches.fill(0, 0, shorterLength);
    longerMatches.fill(0, 0, longerLength);
    let numMatches: number = 0;

    for (let longerIndex: number = 0; longerIndex < longerLength; longerIndex += 1) {
        const longerChar: string = longer[longerIndex];

        const matchingWindowStart: number = Math.max(0, longerIndex - matchingWindowSize);
        const matchingWindowEnd: number = Math.min(longerIndex + matchingWindowSize + 1, shorterLength);

        for (let shorterIndex: number = matchingWindowStart; shorterIndex < matchingWindowEnd; shorterIndex += 1) {
            const shorterChar: string = shorter[shorterIndex];

            if (longerChar === shorterChar && !shorterMatches[shorterIndex]) {
                shorterMatches[shorterIndex] = 1;
                longerMatches[longerIndex] = 1;
                numMatches += 1;
                break;
            }
        }
    }

    if (!numMatches) {
        return 0;
    }

    // Next we calculate the number of transpositions needed to convert `left` into `right` (or vice-versa).

    // `k` is part of an optimization.
    // It's used to keep a persistent index as we iterate over longerLength,
    // which will prevent double matching or a double for-loop.
    let k: number = 0;
    let numTranspositionsNeeded: number = 0;

    for (let longerIndex: number = 0; longerIndex < longerLength; longerIndex += 1) {
        if (!longerMatches[longerIndex]) {
            continue;
        }

        while (!shorterMatches[k]) {
            k += 1;
        }

        if (longer[longerIndex] !== shorter[k]) {
            numTranspositionsNeeded += 1;
        }

        k += 1;
    }

    const m_over_s1: number = numMatches / longerLength;
    const m_over_s2: number = numMatches / shorterLength;
    const mMinusT_over_m: number = (numMatches - numTranspositionsNeeded) / numMatches;

    return (m_over_s1 + m_over_s2 + mMinusT_over_m) / 3;
}

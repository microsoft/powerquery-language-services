// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance

// The standard magic numbers for Winkler adjustments.
const WinklerAdjustment: number = 0.1;
const WinklerMaxCharacterAdjustment: number = 4;
const WinklerScoreThreshold: number = 0.7;

export function calculateJaro(left: string, right: string): number {
    const [shorter, longer]: [string, string] = getNormalized(left, right);
    return calculateJaroForNormalized(shorter, longer);
}

export function calculateJaroWinkler(left: string, right: string): number {
    const [shorter, longer]: [string, string] = getNormalized(left, right);
    let jaroScore: number = calculateJaroForNormalized(shorter, longer);

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

function calculateJaroForNormalized(shorter: string, longer: string): number {
    const shorterLength: number = shorter.length;
    const longerLength: number = longer.length;
    // When trying to find similar characters limit the search to a window based on longer's length.
    const matchingWindowSize: number = Math.floor(longerLength / 2) - 1;

    const shorterMatches: boolean[] = new Array(shorterLength);
    const longerMatches: boolean[] = new Array(longerLength);
    let numMatches: number = 0;

    for (let longerIndex: number = 0; longerIndex < longerLength; longerIndex += 1) {
        const longerChar: string = longer[longerIndex];

        const matchingWindowStart: number = Math.max(0, longerIndex - matchingWindowSize);
        const matchingWindowEnd: number = Math.min(longerIndex + matchingWindowSize + 1, shorterLength);

        for (let shorterIndex: number = matchingWindowStart; shorterIndex < matchingWindowEnd; shorterIndex += 1) {
            const shorterChar: string = shorter[shorterIndex];

            if (longerChar === shorterChar && !shorterMatches[shorterIndex]) {
                shorterMatches[shorterIndex] = true;
                longerMatches[longerIndex] = true;
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

function getNormalized(left: string, right: string): [string, string] {
    left = left.toLowerCase();
    right = right.toLowerCase();

    return left.length < right.length ? [left, right] : [right, left];
}

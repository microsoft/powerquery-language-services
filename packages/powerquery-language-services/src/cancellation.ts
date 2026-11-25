// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, ICancellationToken, TimedCancellationToken } from "@microsoft/powerquery-parser";

export function cancellationTokenOrDefault(cancellationToken: ICancellationToken | undefined): ICancellationToken {
    // Language-service operations default to fifteen seconds, including their parser work.
    return cancellationToken ?? new TimedCancellationToken(15_000);
}

export function isCancellationError(error: unknown): boolean {
    return (
        error instanceof CommonError.CancellationError ||
        (error instanceof CommonError.CommonError && error.innerError instanceof CommonError.CancellationError)
    );
}

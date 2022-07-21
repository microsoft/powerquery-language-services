// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionSettings } from "../inspectionSettings";

export interface AnalysisSettings {
    readonly createCancellationTokenFn: (action: string) => ICancellationToken;
    readonly inspectionSettings: InspectionSettings;
    readonly isWorkspaceCacheAllowed: boolean;
    readonly maybeInitialCorrelationId: number | undefined;
    readonly traceManager: TraceManager;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { InspectionSettings } from "../../../../inspectionSettings";
import { ScopeById } from "../../../scope";
import { TypeById } from "../../../typeCache";

export interface InspectTypeState extends InspectionSettings {
    readonly typeById: TypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly scopeById: ScopeById;
    // Tracks which nodes are being resolved in the current execution path.
    // Used to break true recursion (e.g., `let x = x`).
    readonly computingNodeIds: Set<number>;
    // Stores in-flight promises so parallel branches can await an already-started resolution.
    readonly typePromiseById: Map<number, Promise<Type.TPowerQueryType>>;
}

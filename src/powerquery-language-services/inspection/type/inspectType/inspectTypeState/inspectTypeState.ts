// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { type InspectionSettings } from "../../../../inspectionSettings";
import { type ScopeById } from "../../../scope";
import { type TypeById } from "../../../typeCache";

export interface InspectTypeState extends InspectionSettings {
    readonly typeById: TypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly scopeById: ScopeById;
}

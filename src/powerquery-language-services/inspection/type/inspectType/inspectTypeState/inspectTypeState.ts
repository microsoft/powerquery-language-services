// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectionSettings } from "../../../../inspectionSettings";
import { ScopeById } from "../../../scope";
import { TypeById } from "../../../typeCache";

export interface InspectTypeState extends InspectionSettings {
    readonly typeById: TypeById;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly scopeById: ScopeById;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Library } from "./library";

export abstract class ILibraryProvider {
    public abstract standardLibrary(): Library;
}

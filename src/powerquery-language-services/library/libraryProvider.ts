// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Library } from "./library";

export abstract class LibraryProvider {
    public abstract standardLibrary(): Library;
}

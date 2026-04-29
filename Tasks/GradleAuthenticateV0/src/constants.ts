// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

export const DEFAULT_DUMMY_VERSION = '0.0.0';

export function normalizeUrl(url: string): string {
    return url.toLowerCase().replace(/\/+$/, '');
}

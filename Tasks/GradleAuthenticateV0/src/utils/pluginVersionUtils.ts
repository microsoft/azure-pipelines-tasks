// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as tl from 'azure-pipelines-task-lib/task';

const SAFE_PLUGIN_VERSION_PATTERN = /^[0-9A-Za-z.+_-]{1,64}$/;

export function assertSafePluginVersions(versions: string[]): void {
    if (versions.some(version => !SAFE_PLUGIN_VERSION_PATTERN.test(version))) {
        throw new Error(tl.loc('Error_InvalidPluginVersion'));
    }
}

// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as tl from 'azure-pipelines-task-lib/task';
import { discoverPluginVersions } from './buildFileScanner';
import { getJarVersion } from './ciJarResolver';
import { DEFAULT_DUMMY_VERSION } from './constants';

interface VersionInputs {
    buildFiles: string[];
    pluginToolVersion: string;
    ciJarPath: string | null;
}

export interface VersionResult {
    versions: string[];
    source: 'buildfiles' | 'input' | 'jar';
}

/**
 * Determine which plugin version(s) to lay out in the local Maven repo.
 *
 * Priority:
 * 1. Versions declared in build files (pinned or dynamic-synthesized)
 * 2. Explicit pluginToolVersion input
 * 3. Version extracted from the resolved CI JAR filename
 *
 * Returns null (and sets TaskResult.Failed) when no version can be determined.
 */
export function resolveVersions(inputs: VersionInputs): VersionResult | null {
    const versions = discoverPluginVersions(inputs.buildFiles);

    if (versions.length > 0) {
        return { versions, source: 'buildfiles' };
    }

    // Fallback chain when no versions found in build files
    if (inputs.pluginToolVersion) {
        console.log(tl.loc('Info_PluginVersionFromInput', inputs.pluginToolVersion));
        return { versions: [inputs.pluginToolVersion], source: 'input' };
    }

    if (inputs.ciJarPath) {
        const jarVer = getJarVersion(inputs.ciJarPath);
        if (jarVer && jarVer !== DEFAULT_DUMMY_VERSION) {
            console.log(tl.loc('Info_PluginVersionBundled', jarVer));
            return { versions: [jarVer], source: 'jar' };
        }
    }

    tl.setResult(tl.TaskResult.Failed, tl.loc('Error_CouldNotDetermineVersion'));
    return null;
}

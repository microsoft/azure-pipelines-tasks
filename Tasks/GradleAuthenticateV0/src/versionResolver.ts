// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as tl from 'azure-pipelines-task-lib/task';
import { discoverPluginVersions } from './buildFileScanner';
import { getJarVersion } from './ciJarResolver';
import { DEFAULT_VERSION } from './constants';

interface VersionInputs {
    buildFiles: string[];
    pluginToolVersion: string;
    ciJarPath: string | null;
}

export interface VersionResult {
    versions: string[];
    source: 'buildfiles' | 'input' | 'jar' | 'fallback';
}

/**
 * Determine which plugin version(s) to lay out in the local Maven repo.
 *
 * Priority:
 * 1. Versions declared in build files (pinned or dynamic-synthesized)
 * 2. Explicit pluginToolVersion input
 * 3. Version extracted from the resolved CI JAR filename
 * 4. Default dummy version (the version is only used for the local file://
 *    Maven repo layout — any value works)
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
        if (jarVer) {
            console.log(tl.loc('Info_PluginVersionBundled', jarVer));
            return { versions: [jarVer], source: 'jar' };
        }
    }

    // Last resort: use a dummy version for the local Maven layout.
    // The version is cosmetic — the init script resolves the JAR from
    // the local file:// repo regardless of the version string.
    console.log(tl.loc('Info_PluginVersionBundled', DEFAULT_VERSION));
    return { versions: [DEFAULT_VERSION], source: 'fallback' };
}

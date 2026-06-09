// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

/**
 * Resolve the CI JAR:
 * 1. GRADLE_CREDPROVIDER_HOME env var — optional override (usually unset)
 * 2. Bundled JAR shipped with the task (primary source, downloaded at build time from externals)
 */
export function resolveCiJar(): string {
    // Check override first
    const credproviderHome = process.env['GRADLE_CREDPROVIDER_HOME'];
    if (credproviderHome) {
        const jar = findJarInDir(credproviderHome);
        if (jar) {
            console.log(tl.loc('Info_CiJarFromHome', jar));
            return jar;
        }
    }

    // Primary: Bundled JAR (downloaded via make.json externals at build time)
    const bundledDir = path.join(__dirname, '..', 'GradleCredProvider');
    const jar = findJarInDir(bundledDir);
    if (jar) {
        console.log(tl.loc('Info_CiJarFromBundled', jar));
        return jar;
    }

    throw new Error(tl.loc('Error_NoCiJarFound'));
}

/**
 * Extract the version from a credprovider JAR filename.
 * Expected format: artifacts-gradle-credprovider-<version>.jar
 */
export function getJarVersion(jarPath: string): string | null {
    const match = path.basename(jarPath).match(/artifacts-gradle-credprovider-(.+)\.jar$/);
    return match ? match[1] : null;
}

function findJarInDir(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const jars = fs.readdirSync(dir).filter(f => f.endsWith('.jar')).sort();
    if (jars.length > 0) {
        return path.join(dir, jars[0]);
    }
    return null;
}

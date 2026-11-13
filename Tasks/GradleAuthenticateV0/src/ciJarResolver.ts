// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import * as tl from 'azure-pipelines-task-lib/task';

interface CiProviderRelease {
    jarSha256: string;
}

const release: CiProviderRelease = require('../data/credprovider-release.json');

export interface ResolvedCiJar {
    path: string;
    content: Buffer;
}

/**
 * Resolve the CI JAR:
 * 1. GRADLE_CREDPROVIDER_HOME env var — optional override (usually unset)
 * 2. Bundled JAR downloaded at task build time, verified before staging.
 */
export function resolveCiJar(): ResolvedCiJar {
    // Check override first
    const credproviderHome = process.env['GRADLE_CREDPROVIDER_HOME'];
    if (credproviderHome) {
        const jar = findJarInDir(credproviderHome);
        if (jar) {
            tl.debug(tl.loc('Info_CiJarFromHome'));
            return { path: jar, content: fs.readFileSync(jar) };
        }
    }

    if (typeof release.jarSha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(release.jarSha256)) {
        throw new Error(tl.loc('Error_InvalidCiProviderRelease'));
    }

    const jar = findJarInDir(path.join(__dirname, '..', 'GradleCredProvider'));
    if (!jar) {
        throw new Error(tl.loc('Error_NoCiJarFound'));
    }

    const content = fs.readFileSync(jar);
    const actualChecksum = createHash('sha256').update(content).digest('hex');
    if (actualChecksum !== release.jarSha256.toLowerCase()) {
        throw new Error(tl.loc('Error_CiProviderChecksumMismatch'));
    }

    tl.debug(tl.loc('Info_CiJarFromBundled'));
    return { path: jar, content };
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

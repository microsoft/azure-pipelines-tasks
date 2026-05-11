// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { normalizeUrl, AZURE_ARTIFACTS_URL_PATTERN } from './constants';

/**
 * Feed URL entry discovered from build files or task inputs.
 */
export interface FeedUrl {
    url: string;
    source: string; // which file or input it came from
}


/**
 * Scan the listed build files for Azure Artifacts feed URLs and merge with
 * explicitly provided repository URLs. Returns deduplicated feed URLs.
 */
export function discoverFeedUrls(buildFiles: string[], repositoryUrls: string[]): FeedUrl[] {
    // When explicit repository URLs are provided, use only those feeds.
    // Build files are still used for plugin version discovery but not for
    // feed URL scanning — the user has explicitly specified which feeds to auth.
    if (repositoryUrls.length > 0) {
        return repositoryUrls.map(url => ({ url, source: 'repositoryUrl input' }));
    }

    const seen = new Set<string>();
    const feeds: FeedUrl[] = [];

    // Scan each build file for pkgs.dev.azure.com URLs
    for (const filePath of buildFiles) {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
            tl.warning(tl.loc('Warning_BuildFileNotFound', resolved));
            continue;
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        const matches = content.match(AZURE_ARTIFACTS_URL_PATTERN);
        if (matches) {
            for (const rawUrl of matches) {
                const normalized = normalizeUrl(rawUrl);
                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    feeds.push({ url: rawUrl, source: filePath });
                }
            }
        }
    }

    return feeds;
}

/**
 * Extract the credprovider plugin version from a Gradle build file.
 *
 * Supports two declaration styles:
 * 1. plugins {} DSL (settings.gradle or build.gradle):
 *    - Groovy: id 'com.microsoft.azure.artifacts.credprovider' version '1.+'
 *    - Kotlin: id("com.microsoft.azure.artifacts.credprovider") version "1.+"
 * 2. buildscript { dependencies { classpath } } (build.gradle):
 *    - classpath 'com.microsoft.azure:artifacts-gradle-credprovider:1.+'
 *    - classpath("com.microsoft.azure:artifacts-gradle-credprovider:1.+")
 */
export function extractPluginVersion(gradleFilePath: string): string | null {
    if (!fs.existsSync(gradleFilePath)) {
        return null;
    }

    const content = fs.readFileSync(gradleFilePath, 'utf-8');

    const patterns = [
        // plugins {} DSL — Groovy
        /id\s+['"]com\.microsoft\.azure\.artifacts\.credprovider['"]\s+version\s+['"]([^'"]+)['"]/,
        // plugins {} DSL — Kotlin
        /id\s*\(\s*['"]com\.microsoft\.azure\.artifacts\.credprovider['"]\s*\)\s+version\s+['"]([^'"]+)['"]/,
        // buildscript { classpath } — Groovy/Kotlin
        /classpath\s*\(?\s*['"]com\.microsoft\.azure:artifacts-gradle-credprovider:([^'"]+)['"]/,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

/**
 * Discover all concrete plugin versions declared across the listed build files.
 *
 * Multiple settings.gradle / build.gradle files may each declare a different
 * credprovider plugin version (pins like '1.0.0' or dynamic like '1.+').
 * Dynamic versions are noted but only add the bundled JAR version when no
 * pinned versions exist — Gradle resolves dynamic versions via maven-metadata.xml.
 *
 * Returns deduplicated concrete versions suitable for laying out in the
 * local Maven repo. Returns an empty array if no versions were found.
 */
export function discoverPluginVersions(buildFiles: string[]): string[] {
    const gradleFiles = buildFiles.filter(f => {
        const base = path.basename(f);
        return base.endsWith('.gradle') || base.endsWith('.gradle.kts');
    });

    const versions: string[] = [];
    const dynamicPatterns: string[] = [];

    for (const gf of gradleFiles) {
        const ver = extractPluginVersion(path.resolve(gf));
        if (ver) {
            console.log(tl.loc('Info_PluginVersionFromFile', gf, ver));
            if (ver.includes('+')) {
                dynamicPatterns.push(ver);
                console.log(tl.loc('Info_DynamicVersionDetected', ver));
            } else if (!versions.includes(ver)) {
                versions.push(ver);
            }
        }
    }

    // For each dynamic pattern, synthesize a concrete version that satisfies
    // the range by replacing '+' with '0' (e.g. '1.+' → '1.0', '1.1.+' → '1.1.0',
    // '+' → '0'). If either a pinned version or a previously synthesized version
    // already satisfies the pattern, skip it — Gradle will resolve via maven-metadata.xml.
    for (const pattern of dynamicPatterns) {
        const synthesized = pattern.replace('+', '0');
        if (!versions.includes(synthesized)) {
            versions.push(synthesized);
            console.log(tl.loc('Info_SynthesizedVersion', synthesized, pattern));
        }
    }

    return versions;
}

// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';

/**
 * Lay out the CI JAR, artifact POM, and plugin marker POM in Maven local repo format.
 *
 * Multiple settings.gradle files (root, buildSrc, composite builds) may each
 * declare a different credprovider plugin version. The same CI JAR is laid out
 * under every requested version directory so that each `plugins {}` block
 * resolves successfully from the local file:// repo.
 *
 * Resulting structure (for each version):
 *   <repoDir>/
 *     com/microsoft/azure/
 *       artifacts-gradle-credprovider/<version>/
 *         artifacts-gradle-credprovider-<version>.jar
 *         artifacts-gradle-credprovider-<version>.pom
 *       artifacts-gradle-credprovider/maven-metadata.xml   (lists all versions)
 *     com/microsoft/azure/artifacts/credprovider/
 *       com.microsoft.azure.artifacts.credprovider.gradle.plugin/<version>/
 *         com.microsoft.azure.artifacts.credprovider.gradle.plugin-<version>.pom
 *       com.microsoft.azure.artifacts.credprovider.gradle.plugin/maven-metadata.xml
 */
export function layoutMavenRepo(repoDir: string, jarSourcePath: string, versions: string[]): void {
    const groupId = 'com.microsoft.azure';
    const artifactId = 'artifacts-gradle-credprovider';
    const pluginId = 'com.microsoft.azure.artifacts.credprovider';
    const markerArtifactId = `${pluginId}.gradle.plugin`;

    for (const version of versions) {
        // --- Main artifact (JAR + POM) ---
        const artifactDir = path.join(repoDir, ...groupId.split('.'), artifactId, version);
        fs.mkdirSync(artifactDir, { recursive: true });

        fs.copyFileSync(jarSourcePath, path.join(artifactDir, `${artifactId}-${version}.jar`));
        fs.writeFileSync(
            path.join(artifactDir, `${artifactId}-${version}.pom`),
            generateArtifactPom(groupId, artifactId, version),
            'utf-8'
        );

        // --- Plugin marker POM ---
        const markerDir = path.join(repoDir, ...pluginId.split('.'), markerArtifactId, version);
        fs.mkdirSync(markerDir, { recursive: true });

        fs.writeFileSync(
            path.join(markerDir, `${markerArtifactId}-${version}.pom`),
            generateMarkerPom(pluginId, markerArtifactId, groupId, artifactId, version),
            'utf-8'
        );
    }

    // Write maven-metadata.xml listing all versions (for dynamic version resolution).
    // Merge with existing metadata from prior runs to avoid losing previously laid-out versions.
    const artifactMetadataDir = path.join(repoDir, ...groupId.split('.'), artifactId);
    const existingArtifactVersions = readExistingVersions(path.join(artifactMetadataDir, 'maven-metadata.xml'));
    const allArtifactVersions = mergeVersions(existingArtifactVersions, versions);
    fs.writeFileSync(
        path.join(artifactMetadataDir, 'maven-metadata.xml'),
        generateMavenMetadata(groupId, artifactId, allArtifactVersions),
        'utf-8'
    );

    const markerMetadataDir = path.join(repoDir, ...pluginId.split('.'), markerArtifactId);
    const existingMarkerVersions = readExistingVersions(path.join(markerMetadataDir, 'maven-metadata.xml'));
    const allMarkerVersions = mergeVersions(existingMarkerVersions, versions);
    fs.writeFileSync(
        path.join(markerMetadataDir, 'maven-metadata.xml'),
        generateMavenMetadata(pluginId, markerArtifactId, allMarkerVersions),
        'utf-8'
    );
}

// ---------------------------------------------------------------------------
// XML generators
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateArtifactPom(groupId: string, artifactId: string, version: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${escapeXml(groupId)}</groupId>
  <artifactId>${escapeXml(artifactId)}</artifactId>
  <version>${escapeXml(version)}</version>
  <packaging>jar</packaging>
  <name>Azure Artifacts Gradle Credential Provider CI Plugin</name>
  <dependencies/>
</project>
`;
}

function generateMarkerPom(
    markerGroupId: string, markerArtifactId: string,
    depGroupId: string, depArtifactId: string, version: string
): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${escapeXml(markerGroupId)}</groupId>
  <artifactId>${escapeXml(markerArtifactId)}</artifactId>
  <version>${escapeXml(version)}</version>
  <packaging>pom</packaging>
  <name>Azure Artifacts Credential Provider Plugin Marker</name>
  <dependencies>
    <dependency>
      <groupId>${escapeXml(depGroupId)}</groupId>
      <artifactId>${escapeXml(depArtifactId)}</artifactId>
      <version>${escapeXml(version)}</version>
    </dependency>
  </dependencies>
</project>
`;
}

function generateMavenMetadata(groupId: string, artifactId: string, versions: string[]): string {
    const latest = versions[versions.length - 1];
    const versionElements = versions.map(v => `      <version>${escapeXml(v)}</version>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<metadata>
  <groupId>${escapeXml(groupId)}</groupId>
  <artifactId>${escapeXml(artifactId)}</artifactId>
  <versioning>
    <latest>${escapeXml(latest)}</latest>
    <release>${escapeXml(latest)}</release>
    <versions>
${versionElements}
    </versions>
  </versioning>
</metadata>
`;
}

/**
 * Parse existing maven-metadata.xml and extract the <version> elements.
 * Returns an empty array if the file doesn't exist or can't be parsed.
 */
function readExistingVersions(metadataPath: string): string[] {
    if (!fs.existsSync(metadataPath)) {
        return [];
    }
    try {
        const content = fs.readFileSync(metadataPath, 'utf-8');
        const versions: string[] = [];
        const regex = /<version>([^<]+)<\/version>/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
            versions.push(match[1]);
        }
        return versions;
    } catch {
        return [];
    }
}

/**
 * Merge two version lists, deduplicating while preserving order.
 * Existing versions come first, then any new versions not already present.
 */
function mergeVersions(existing: string[], incoming: string[]): string[] {
    const seen = new Set(existing);
    const merged = [...existing];
    for (const v of incoming) {
        if (!seen.has(v)) {
            seen.add(v);
            merged.push(v);
        }
    }
    return merged;
}

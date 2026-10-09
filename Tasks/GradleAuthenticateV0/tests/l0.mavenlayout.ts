// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { layoutMavenRepo } from '../src/mavenLayout';

const GROUP_PATH = path.join('com', 'microsoft', 'azure');
const ARTIFACT_ID = 'artifacts-gradle-credprovider';
const MARKER_PATH = path.join('com', 'microsoft', 'azure', 'artifacts', 'credprovider');
const MARKER_ARTIFACT_ID = 'com.microsoft.azure.artifacts.credprovider.gradle.plugin';

describe('Unit Tests - Maven Repo Layout', function () {
    let tempDir: string;
    let dummyJar: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-maven-layout-test-'));
        // Create a dummy JAR file to use as the CI JAR source
        dummyJar = path.join(tempDir, 'source.jar');
        fs.writeFileSync(dummyJar, 'dummy-jar-content', 'utf-8');
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    // -----------------------------------------------------------------------
    // Single version layout
    // -----------------------------------------------------------------------

    describe('single version layout', () => {
        it('should create artifact JAR at the correct path', () => {
            const repoDir = path.join(tempDir, 'repo');
            layoutMavenRepo(repoDir, dummyJar, ['1.0.0']);

            const jarPath = path.join(repoDir, GROUP_PATH, ARTIFACT_ID, '1.0.0', `${ARTIFACT_ID}-1.0.0.jar`);
            assert.ok(fs.existsSync(jarPath), `JAR should exist at ${jarPath}`);
            assert.strictEqual(fs.readFileSync(jarPath, 'utf-8'), 'dummy-jar-content');
        });

        it('should create artifact POM at the correct path', () => {
            const repoDir = path.join(tempDir, 'repo');
            layoutMavenRepo(repoDir, dummyJar, ['1.0.0']);

            const pomPath = path.join(repoDir, GROUP_PATH, ARTIFACT_ID, '1.0.0', `${ARTIFACT_ID}-1.0.0.pom`);
            assert.ok(fs.existsSync(pomPath), 'Artifact POM should exist');
            const pom = fs.readFileSync(pomPath, 'utf-8');
            assert.ok(pom.includes('<version>1.0.0</version>'));
            assert.ok(pom.includes('<dependencies/>'), 'POM should declare no dependencies');
        });

        it('should create plugin marker POM at the correct path', () => {
            const repoDir = path.join(tempDir, 'repo');
            layoutMavenRepo(repoDir, dummyJar, ['1.0.0']);

            const markerPomPath = path.join(repoDir, MARKER_PATH, MARKER_ARTIFACT_ID, '1.0.0', `${MARKER_ARTIFACT_ID}-1.0.0.pom`);
            assert.ok(fs.existsSync(markerPomPath), 'Plugin marker POM should exist');
            const pom = fs.readFileSync(markerPomPath, 'utf-8');
            assert.ok(pom.includes(`<artifactId>${ARTIFACT_ID}</artifactId>`), 'Marker POM should reference main artifact');
            assert.ok(pom.includes('<version>1.0.0</version>'));
        });

        it('should write maven-metadata.xml for the artifact', () => {
            const repoDir = path.join(tempDir, 'repo');
            layoutMavenRepo(repoDir, dummyJar, ['1.0.0']);

            const metadataPath = path.join(repoDir, GROUP_PATH, ARTIFACT_ID, 'maven-metadata.xml');
            assert.ok(fs.existsSync(metadataPath), 'maven-metadata.xml should exist');
            const xml = fs.readFileSync(metadataPath, 'utf-8');
            assert.ok(xml.includes('<version>1.0.0</version>'));
            assert.ok(xml.includes('<latest>1.0.0</latest>'));
        });
    });

    // -----------------------------------------------------------------------
    // Multiple versions in one call
    // -----------------------------------------------------------------------

    describe('multiple versions in one call', () => {
        it('should lay out each version in its own directory', () => {
            const repoDir = path.join(tempDir, 'repo');
            layoutMavenRepo(repoDir, dummyJar, ['1.0.0', '1.1.0']);

            for (const v of ['1.0.0', '1.1.0']) {
                const jarPath = path.join(repoDir, GROUP_PATH, ARTIFACT_ID, v, `${ARTIFACT_ID}-${v}.jar`);
                assert.ok(fs.existsSync(jarPath), `JAR for version ${v} should exist`);
                const markerPath = path.join(repoDir, MARKER_PATH, MARKER_ARTIFACT_ID, v, `${MARKER_ARTIFACT_ID}-${v}.pom`);
                assert.ok(fs.existsSync(markerPath), `Marker POM for version ${v} should exist`);
            }
        });

        it('should list all versions in maven-metadata.xml', () => {
            const repoDir = path.join(tempDir, 'repo');
            layoutMavenRepo(repoDir, dummyJar, ['1.0.0', '2.0.0']);

            const xml = fs.readFileSync(path.join(repoDir, GROUP_PATH, ARTIFACT_ID, 'maven-metadata.xml'), 'utf-8');
            assert.ok(xml.includes('<version>1.0.0</version>'));
            assert.ok(xml.includes('<version>2.0.0</version>'));
            assert.ok(xml.includes('<latest>2.0.0</latest>'), 'Latest should be the last version');
        });
    });

    // -----------------------------------------------------------------------
    // Sequential runs (multi-invocation / additive)
    // -----------------------------------------------------------------------

    describe('sequential runs with the same repo directory', () => {
        it('should preserve version 1.0.0 files when version 1.1.0 is added in a second run', () => {
            const repoDir = path.join(tempDir, 'repo');

            // Run 1: version 1.0.0
            layoutMavenRepo(repoDir, dummyJar, ['1.0.0']);

            // Run 2: version 1.1.0 (different service connection / different settings.gradle)
            layoutMavenRepo(repoDir, dummyJar, ['1.1.0']);

            // Both version directories should exist
            const jar100 = path.join(repoDir, GROUP_PATH, ARTIFACT_ID, '1.0.0', `${ARTIFACT_ID}-1.0.0.jar`);
            const jar110 = path.join(repoDir, GROUP_PATH, ARTIFACT_ID, '1.1.0', `${ARTIFACT_ID}-1.1.0.jar`);
            assert.ok(fs.existsSync(jar100), 'Run 1 JAR (1.0.0) should still exist after run 2');
            assert.ok(fs.existsSync(jar110), 'Run 2 JAR (1.1.0) should exist');
        });

        it('should merge maven-metadata.xml across runs', () => {
            const repoDir = path.join(tempDir, 'repo');

            layoutMavenRepo(repoDir, dummyJar, ['1.0.0']);
            layoutMavenRepo(repoDir, dummyJar, ['1.1.0']);

            const xml = fs.readFileSync(path.join(repoDir, GROUP_PATH, ARTIFACT_ID, 'maven-metadata.xml'), 'utf-8');
            assert.ok(xml.includes('<version>1.0.0</version>'), 'metadata should include version from run 1');
            assert.ok(xml.includes('<version>1.1.0</version>'), 'metadata should include version from run 2');
            assert.ok(xml.includes('<latest>1.1.0</latest>'), 'latest should reflect the most recently added version');
        });

        it('should not duplicate versions when the same version is laid out twice', () => {
            const repoDir = path.join(tempDir, 'repo');

            layoutMavenRepo(repoDir, dummyJar, ['1.0.0']);
            layoutMavenRepo(repoDir, dummyJar, ['1.0.0']);

            const xml = fs.readFileSync(path.join(repoDir, GROUP_PATH, ARTIFACT_ID, 'maven-metadata.xml'), 'utf-8');
            const matches = xml.match(/<version>1\.0\.0<\/version>/g);
            assert.strictEqual(matches?.length, 1, 'Version 1.0.0 should appear exactly once in metadata');
        });
    });

    // -----------------------------------------------------------------------
    // Corrupt / missing metadata recovery
    // -----------------------------------------------------------------------

    describe('corrupt metadata recovery', () => {
        it('should recover from corrupt maven-metadata.xml', () => {
            const repoDir = path.join(tempDir, 'repo');

            // Run 1: create valid layout
            layoutMavenRepo(repoDir, dummyJar, ['1.0.0']);

            // Corrupt the metadata file
            const metadataPath = path.join(repoDir, GROUP_PATH, ARTIFACT_ID, 'maven-metadata.xml');
            fs.writeFileSync(metadataPath, 'not valid xml {{{{', 'utf-8');

            // Run 2: should still produce valid output (corrupt metadata treated as empty)
            layoutMavenRepo(repoDir, dummyJar, ['1.1.0']);

            const xml = fs.readFileSync(metadataPath, 'utf-8');
            assert.ok(xml.includes('<version>1.1.0</version>'), 'New version should be in metadata');
            // 1.0.0 is lost from metadata (corrupt file) but its directory still exists
            const jar100 = path.join(repoDir, GROUP_PATH, ARTIFACT_ID, '1.0.0', `${ARTIFACT_ID}-1.0.0.jar`);
            assert.ok(fs.existsSync(jar100), 'Run 1 JAR files should still exist on disk');
        });
    });
});

// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { normalizeUrl } from '../src/constants';
import { generateInitScript } from '../src/initScript';
import { extractPluginVersion, discoverFeedUrls } from '../src/buildFileScanner';
import { probeFeedTenantId } from '../src/authConfig';

// Required for tl.loc() / tl.warning() calls inside discoverFeedUrls
tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

describe('Unit Tests - Pure Functions', function () {

    describe('normalizeUrl', () => {
        it('should lowercase and strip trailing slashes', () => {
            assert.strictEqual(normalizeUrl('https://PKGS.dev.azure.com/Org/'), 'https://pkgs.dev.azure.com/org');
        });

        it('should handle URLs without trailing slashes', () => {
            assert.strictEqual(normalizeUrl('https://pkgs.dev.azure.com/org'), 'https://pkgs.dev.azure.com/org');
        });

        it('should strip multiple trailing slashes', () => {
            assert.strictEqual(normalizeUrl('https://example.com///'), 'https://example.com');
        });

        it('should return empty string for empty input', () => {
            assert.strictEqual(normalizeUrl(''), '');
        });
    });

    describe('generateInitScript', () => {
        it('should embed the version in the classpath declaration', () => {
            const script = generateInitScript('1.2.3');
            assert.ok(script.includes("classpath 'com.microsoft.azure:artifacts-gradle-credprovider:1.2.3'"),
                'Script should contain the versioned classpath');
        });

        it('should use + as dynamic version when no specific version is provided', () => {
            const script = generateInitScript('+');
            assert.ok(script.includes("classpath 'com.microsoft.azure:artifacts-gradle-credprovider:+'"),
                'Script should contain the dynamic + classpath');
        });

        it('should reference ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO env var', () => {
            const script = generateInitScript('1.0.0');
            assert.ok(script.includes('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO'),
                'Script should reference the CI plugin repo env var');
        });
    });

    describe('extractPluginVersion', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-test-'));
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('should extract version from Groovy plugins DSL', () => {
            const filePath = path.join(tempDir, 'settings.gradle');
            fs.writeFileSync(filePath, `
plugins {
    id 'com.microsoft.azure.artifacts.credprovider' version '1.2.3'
}
`);
            assert.strictEqual(extractPluginVersion(filePath), '1.2.3');
        });

        it('should extract version from Kotlin plugins DSL', () => {
            const filePath = path.join(tempDir, 'settings.gradle.kts');
            fs.writeFileSync(filePath, `
plugins {
    id("com.microsoft.azure.artifacts.credprovider") version "2.0.0"
}
`);
            assert.strictEqual(extractPluginVersion(filePath), '2.0.0');
        });

        it('should extract version from buildscript classpath', () => {
            const filePath = path.join(tempDir, 'build.gradle');
            fs.writeFileSync(filePath, `
buildscript {
    dependencies {
        classpath 'com.microsoft.azure:artifacts-gradle-credprovider:1.+'
    }
}
`);
            assert.strictEqual(extractPluginVersion(filePath), '1.+');
        });

        it('should return null when no plugin is declared', () => {
            const filePath = path.join(tempDir, 'build.gradle');
            fs.writeFileSync(filePath, `
plugins {
    id 'java'
}
`);
            assert.strictEqual(extractPluginVersion(filePath), null);
        });

        it('should return null for non-existent file', () => {
            assert.strictEqual(extractPluginVersion(path.join(tempDir, 'missing.gradle')), null);
        });
    });

    describe('discoverFeedUrls', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-feed-test-'));
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('should discover pkgs.dev.azure.com URLs from build files', () => {
            const filePath = path.join(tempDir, 'settings.gradle');
            fs.writeFileSync(filePath, `
dependencyResolutionManagement {
    repositories {
        maven {
            url 'https://pkgs.dev.azure.com/myorg/myproject/_packaging/myfeed/maven/v1'
        }
    }
}
`);
            const feeds = discoverFeedUrls([filePath], '');
            assert.strictEqual(feeds.length, 1);
            assert.strictEqual(feeds[0].url, 'https://pkgs.dev.azure.com/myorg/myproject/_packaging/myfeed/maven/v1');
            assert.strictEqual(feeds[0].source, filePath);
        });

        it('should discover multiple URLs from a single build file', () => {
            const filePath = path.join(tempDir, 'build.gradle');
            fs.writeFileSync(filePath, `
repositories {
    maven { url 'https://pkgs.dev.azure.com/org/proj/_packaging/feed1/maven/v1' }
    maven { url 'https://pkgs.dev.azure.com/org/proj/_packaging/feed2/maven/v1' }
}
`);
            const feeds = discoverFeedUrls([filePath], '');
            assert.strictEqual(feeds.length, 2);
        });

        it('should use only repositoryUrl when it is provided, ignoring build file URLs', () => {
            const filePath = path.join(tempDir, 'settings.gradle');
            fs.writeFileSync(filePath, `
pluginManagement {
    repositories {
        maven { url 'https://pkgs.dev.azure.com/org/proj/_packaging/feed1/maven/v1' }
    }
}
`);
            const repoUrl = 'https://pkgs.dev.azure.com/org/proj/_packaging/feed2/maven/v1';
            const feeds = discoverFeedUrls([filePath], repoUrl);
            assert.strictEqual(feeds.length, 1, 'Should only have the repositoryUrl feed');
            assert.strictEqual(feeds[0].url, repoUrl);
            assert.strictEqual(feeds[0].source, 'repositoryUrl input');
        });

        it('should deduplicate URLs across build files when no repositoryUrl', () => {
            const settingsFile = path.join(tempDir, 'settings.gradle');
            const buildFile = path.join(tempDir, 'build.gradle');
            const feedUrl = 'https://pkgs.dev.azure.com/org/proj/_packaging/feed/maven/v1';
            fs.writeFileSync(settingsFile, `maven { url '${feedUrl}' }`);
            fs.writeFileSync(buildFile, `maven { url '${feedUrl}' }`);

            const feeds = discoverFeedUrls([settingsFile, buildFile], '');
            assert.strictEqual(feeds.length, 1, 'Same URL in multiple build files should be deduplicated');
        });

        it('should return empty array when no URLs found', () => {
            const filePath = path.join(tempDir, 'settings.gradle');
            fs.writeFileSync(filePath, `plugins { id 'java' }`);

            const feeds = discoverFeedUrls([filePath], '');
            assert.strictEqual(feeds.length, 0);
        });

        it('should skip and warn on missing build files', () => {
            const feeds = discoverFeedUrls([path.join(tempDir, 'missing.gradle')], '');
            assert.strictEqual(feeds.length, 0);
        });

        it('should work with repositoryUrl only (no build files)', () => {
            const repoUrl = 'https://pkgs.dev.azure.com/org/proj/_packaging/feed/maven/v1';
            const feeds = discoverFeedUrls([], repoUrl);
            assert.strictEqual(feeds.length, 1);
            assert.strictEqual(feeds[0].url, repoUrl);
            assert.strictEqual(feeds[0].source, 'repositoryUrl input');
        });
    });

    describe('probeFeedTenantId', () => {
        let server: http.Server;
        let serverPort: number;

        afterEach((done) => {
            if (server && server.listening) {
                server.close(done);
            } else {
                done();
            }
        });

        it('should extract X-VSS-ResourceTenant header', (done) => {
            server = http.createServer((_req, res) => {
                res.setHeader('x-vss-resourcetenant', 'test-tenant-guid');
                res.writeHead(401);
                res.end();
            });
            server.listen(0, () => {
                serverPort = (server.address() as any).port;
                probeFeedTenantId(`http://localhost:${serverPort}/feed`).then((tenantId) => {
                    assert.strictEqual(tenantId, 'test-tenant-guid');
                    done();
                }).catch(done);
            });
        });

        it('should return null when header is missing', (done) => {
            server = http.createServer((_req, res) => {
                res.writeHead(200);
                res.end();
            });
            server.listen(0, () => {
                serverPort = (server.address() as any).port;
                probeFeedTenantId(`http://localhost:${serverPort}/feed`).then((tenantId) => {
                    assert.strictEqual(tenantId, null);
                    done();
                }).catch(done);
            });
        });

        it('should return null on connection error', (done) => {
            // Use a port that nothing is listening on
            probeFeedTenantId('http://localhost:1/feed').then((tenantId) => {
                assert.strictEqual(tenantId, null);
                done();
            }).catch(done);
        });
    });
});

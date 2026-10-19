// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { writeAuthConfig, FeedAuthEntry, AuthConfigFile } from '../src/authConfig';

// Required for tl.loc() calls inside writeAuthConfig (corrupt config warning)
tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

describe('Unit Tests - Auth Config Contract', function () {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-auth-config-test-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    // -----------------------------------------------------------------------
    // JSON schema: top-level structure
    // -----------------------------------------------------------------------

    describe('JSON schema', () => {
        it('should write a valid JSON file with a feeds array', () => {
            const configPath = path.join(tempDir, 'config.json');
            writeAuthConfig(configPath, []);

            const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.ok(Array.isArray(content.feeds), 'feeds must be an array');
            assert.strictEqual(content.feeds.length, 0);
        });

        it('should pretty-print JSON with 2-space indentation', () => {
            const configPath = path.join(tempDir, 'config.json');
            const entry: FeedAuthEntry = {
                url: 'https://pkgs.dev.azure.com/org/_packaging/feed/maven/v1',
                auth: 'sat',
                ciSystem: 'ado',
            };
            writeAuthConfig(configPath, [entry]);

            const raw = fs.readFileSync(configPath, 'utf-8');
            // Verify indentation — second line should start with 2 spaces
            const lines = raw.split('\n');
            assert.ok(lines[1].startsWith('  '), 'JSON should be indented with 2 spaces');
        });
    });

    // -----------------------------------------------------------------------
    // SAT entry contract
    // -----------------------------------------------------------------------

    describe('SAT entry contract', () => {
        it('should include url, auth, and ciSystem fields', () => {
            const configPath = path.join(tempDir, 'config.json');
            const entry: FeedAuthEntry = {
                url: 'https://pkgs.dev.azure.com/org/_packaging/feed/maven/v1',
                auth: 'sat',
                ciSystem: 'ado',
            };
            writeAuthConfig(configPath, [entry]);

            const content: AuthConfigFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.strictEqual(content.feeds.length, 1);

            const feed = content.feeds[0];
            assert.strictEqual(feed.url, 'https://pkgs.dev.azure.com/org/_packaging/feed/maven/v1');
            assert.strictEqual(feed.auth, 'sat');
            assert.strictEqual(feed.ciSystem, 'ado');
        });

        it('should not include WIF-specific fields on a SAT entry', () => {
            const configPath = path.join(tempDir, 'config.json');
            const entry: FeedAuthEntry = {
                url: 'https://pkgs.dev.azure.com/org/_packaging/feed/maven/v1',
                auth: 'sat',
                ciSystem: 'ado',
            };
            writeAuthConfig(configPath, [entry]);

            const content: AuthConfigFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const feed = content.feeds[0];
            assert.strictEqual(feed.oidcEndpoint, undefined, 'SAT entry should not have oidcEndpoint');
            assert.strictEqual(feed.clientId, undefined, 'SAT entry should not have clientId');
            assert.strictEqual(feed.tenantId, undefined, 'SAT entry should not have tenantId');
        });
    });

    // -----------------------------------------------------------------------
    // WIF entry contract
    // -----------------------------------------------------------------------

    describe('WIF entry contract', () => {
        it('should include url, auth, ciSystem, oidcEndpoint, clientId, and tenantId', () => {
            const configPath = path.join(tempDir, 'config.json');
            const entry: FeedAuthEntry = {
                url: 'https://pkgs.dev.azure.com/contoso/_packaging/shared/maven/v1',
                auth: 'wif',
                ciSystem: 'ado',
                oidcEndpoint: 'https://dev.azure.com/contoso/proj/_apis/distributedtask/hubs/build/plans/plan-id/jobs/job-id/oidctoken?serviceConnectionId=sc-id&api-version=7.1',
                clientId: 'test-client-id',
                tenantId: 'test-tenant-id',
            };
            writeAuthConfig(configPath, [entry]);

            const content: AuthConfigFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.strictEqual(content.feeds.length, 1);

            const feed = content.feeds[0];
            assert.strictEqual(feed.url, 'https://pkgs.dev.azure.com/contoso/_packaging/shared/maven/v1');
            assert.strictEqual(feed.auth, 'wif');
            assert.strictEqual(feed.ciSystem, 'ado');
            assert.strictEqual(feed.oidcEndpoint, entry.oidcEndpoint);
            assert.strictEqual(feed.clientId, 'test-client-id');
            assert.strictEqual(feed.tenantId, 'test-tenant-id');
        });
    });

    // -----------------------------------------------------------------------
    // Merge / deduplication (additive invocations)
    // -----------------------------------------------------------------------

    describe('merge and deduplication', () => {
        it('should merge entries from multiple invocations', () => {
            const configPath = path.join(tempDir, 'config.json');

            // First invocation
            writeAuthConfig(configPath, [
                { url: 'https://pkgs.dev.azure.com/org/_packaging/feed1/maven/v1', auth: 'sat', ciSystem: 'ado' },
            ]);

            // Second invocation — additive
            writeAuthConfig(configPath, [
                { url: 'https://pkgs.dev.azure.com/org/_packaging/feed2/maven/v1', auth: 'sat', ciSystem: 'ado' },
            ]);

            const content: AuthConfigFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.strictEqual(content.feeds.length, 2, 'Should have entries from both invocations');
        });

        it('should deduplicate by normalized URL (case-insensitive)', () => {
            const configPath = path.join(tempDir, 'config.json');

            writeAuthConfig(configPath, [
                { url: 'https://pkgs.dev.azure.com/Org/_packaging/Feed/maven/v1', auth: 'sat', ciSystem: 'ado' },
            ]);

            // Same URL, different casing
            writeAuthConfig(configPath, [
                { url: 'https://pkgs.dev.azure.com/org/_packaging/feed/maven/v1', auth: 'sat', ciSystem: 'ado' },
            ]);

            const content: AuthConfigFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.strictEqual(content.feeds.length, 1, 'Duplicate URL should be deduplicated');
        });

        it('should let later entries overwrite earlier ones for the same URL (SAT → WIF)', () => {
            const configPath = path.join(tempDir, 'config.json');

            // First: SAT
            writeAuthConfig(configPath, [
                { url: 'https://pkgs.dev.azure.com/org/_packaging/feed/maven/v1', auth: 'sat', ciSystem: 'ado' },
            ]);

            // Second: WIF for the same feed
            writeAuthConfig(configPath, [
                { url: 'https://pkgs.dev.azure.com/org/_packaging/feed/maven/v1', auth: 'wif', ciSystem: 'ado', oidcEndpoint: 'https://example.com/oidc', clientId: 'cid', tenantId: 'tid' },
            ]);

            const content: AuthConfigFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.strictEqual(content.feeds.length, 1);
            assert.strictEqual(content.feeds[0].auth, 'wif', 'Later WIF entry should overwrite SAT');
            assert.strictEqual(content.feeds[0].clientId, 'cid');
        });
    });

    // -----------------------------------------------------------------------
    // Corrupt existing config
    // -----------------------------------------------------------------------

    describe('corrupt existing config', () => {
        it('should overwrite corrupt config file and produce valid output', () => {
            const configPath = path.join(tempDir, 'config.json');
            fs.writeFileSync(configPath, 'not valid json {{{{', 'utf-8');

            const entry: FeedAuthEntry = {
                url: 'https://pkgs.dev.azure.com/org/_packaging/feed/maven/v1',
                auth: 'sat',
                ciSystem: 'ado',
            };
            writeAuthConfig(configPath, [entry]);

            const content: AuthConfigFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.strictEqual(content.feeds.length, 1);
            assert.strictEqual(content.feeds[0].auth, 'sat');
            assert.strictEqual(content.feeds[0].ciSystem, 'ado');
        });
    });

    // -----------------------------------------------------------------------
    // Empty entries
    // -----------------------------------------------------------------------

    describe('empty entries', () => {
        it('should write empty feeds array when no entries provided', () => {
            const configPath = path.join(tempDir, 'config.json');
            writeAuthConfig(configPath, []);

            const content: AuthConfigFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.strictEqual(content.feeds.length, 0);
        });

        it('should preserve existing entries when merging with empty', () => {
            const configPath = path.join(tempDir, 'config.json');

            writeAuthConfig(configPath, [
                { url: 'https://pkgs.dev.azure.com/org/_packaging/feed/maven/v1', auth: 'sat', ciSystem: 'ado' },
            ]);

            writeAuthConfig(configPath, []);

            const content: AuthConfigFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.strictEqual(content.feeds.length, 1, 'Existing entries should be preserved');
        });
    });
});

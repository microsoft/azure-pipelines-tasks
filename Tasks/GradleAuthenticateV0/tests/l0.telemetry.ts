// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './testconstants';
import { TestHelpers } from './testhelpers';

describe('GradleAuthenticate L0 - Override Telemetry', function () {
    this.timeout(20000);
    beforeEach(() => {
        TestHelpers.beforeEach();
        delete process.env['GRADLE_CREDPROVIDER_HOME'];
        process.env[TestEnvVars.ciProviderScenario] = 'valid';
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';
    });

    afterEach(() => TestHelpers.afterEach());

    function runner(): ttm.MockTestRunner {
        return new ttm.MockTestRunner(path.join(__dirname, 'testsetup.js'));
    }

    function telemetry(task: ttm.MockTestRunner): Record<string, unknown> {
        const matches = [...task.stdout.matchAll(/^TEST_TELEMETRY:(.+)$/gm)];
        assert.strictEqual(matches.length, 1, 'Expected exactly one telemetry event.');
        const event = JSON.parse(matches[0][1]);
        assert.strictEqual(event.area, 'Packaging');
        assert.strictEqual(event.feature, 'GradleAuthenticateV0');
        return event.data;
    }

    function assertOverrides(data: Record<string, unknown>, expected: boolean): void {
        for (const field of ['IsGradleUserHomeEnvSet', 'IsCredProviderHomeEnvSet', 'IsCiPluginRepoSet', 'IsAuthConfigSet']) {
            assert.strictEqual(data[field], expected, field);
        }
    }

    function setOverrides(): string[] {
        const root = path.dirname(process.env[TestEnvVars.gradleUserHome]!);
        process.env['GRADLE_USER_HOME'] = path.join(root, 'environment-home');
        process.env['GRADLE_CREDPROVIDER_HOME'] = root;
        process.env[TestEnvVars.existingRepoDir] = path.join(root, 'incoming-repository');
        process.env[TestEnvVars.existingAuthConfig] = path.join(root, 'incoming-config.json');
        return [
            process.env['GRADLE_USER_HOME'],
            process.env['GRADLE_CREDPROVIDER_HOME'],
            process.env[TestEnvVars.existingRepoDir]!,
            process.env[TestEnvVars.existingAuthConfig]!,
        ];
    }

    it('should report absent incoming settings even after exporting staging paths', async () => {
        const task = runner();
        await task.runAsync();
        TestHelpers.assertSuccess(task);
        assertOverrides(telemetry(task), false);
        TestHelpers.stagedRepo(task);
    });

    it('should report only presence, not the override values', async () => {
        const values = setOverrides();
        const task = runner();
        await task.runAsync();
        TestHelpers.assertSuccess(task);
        const data = telemetry(task);
        assertOverrides(data, true);
        for (const value of values) {
            assert.ok(!Object.values(data).some(entry => typeof entry === 'string' && entry.includes(value)),
                'Telemetry must not contain override values.');
        }
    });

    it('should treat empty settings as absent', async () => {
        process.env['GRADLE_USER_HOME'] = '';
        process.env['GRADLE_CREDPROVIDER_HOME'] = '';
        process.env[TestEnvVars.existingRepoDir] = '';
        process.env[TestEnvVars.existingAuthConfig] = '';
        const task = runner();
        await task.runAsync();
        TestHelpers.assertSuccess(task);
        assertOverrides(telemetry(task), false);
    });

    it('should distinguish the environment home from the explicit home input', async () => {
        process.env['GRADLE_USER_HOME'] = process.env[TestEnvVars.gradleUserHome];
        delete process.env[TestEnvVars.gradleUserHome];
        const task = runner();
        await task.runAsync();
        TestHelpers.assertSuccess(task);
        const data = telemetry(task);
        assert.strictEqual(data.IsGradleUserHomeEnvSet, true);
        assert.strictEqual(data.IsGradleUserHomeIncluded, false);
    });

    it('should retain incoming presence telemetry when validation fails', async () => {
        setOverrides();
        process.env[TestEnvVars.pluginToolVersion] = '../invalid';
        const task = runner();
        await task.runAsync();
        TestHelpers.assertFailure(task);
        assertOverrides(telemetry(task), true);
    });

    it('should report incoming staging variables on a repeated invocation', async () => {
        const first = runner();
        await first.runAsync();
        TestHelpers.assertSuccess(first);
        assertOverrides(telemetry(first), false);
        const repo = TestHelpers.stagedRepo(first);
        process.env[TestEnvVars.existingRepoDir] = repo;
        process.env[TestEnvVars.existingAuthConfig] = path.join(repo, 'azure-artifacts-auth-config.json');
        const second = runner();
        await second.runAsync();
        TestHelpers.assertSuccess(second);
        const data = telemetry(second);
        assert.strictEqual(data.IsCiPluginRepoSet, true);
        assert.strictEqual(data.IsAuthConfigSet, true);
        assert.strictEqual(data.IsGradleUserHomeEnvSet, false);
        assert.strictEqual(data.IsCredProviderHomeEnvSet, false);
        assert.strictEqual(TestHelpers.stagedRepo(second), repo);
    });
});

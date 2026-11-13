// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './testconstants';
import { TestHelpers } from './testhelpers';

describe('GradleAuthenticate - Verified bundled provider', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    function runner(scenario: string): ttm.MockTestRunner {
        delete process.env['GRADLE_CREDPROVIDER_HOME'];
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';
        process.env[TestEnvVars.ciProviderScenario] = scenario;
        return new ttm.MockTestRunner(path.join(__dirname, 'testsetup.js'));
    }

    function stagedJar(repo: string, version = '1.0.0'): string {
        return path.join(repo, 'com', 'microsoft', 'azure', 'artifacts-gradle-credprovider',
            version, `artifacts-gradle-credprovider-${version}.jar`);
    }

    function bundledJar(): string {
        return path.resolve(process.env[TestEnvVars.agentTempDirectory]!, '..', 'bundled-provider',
            'artifacts-gradle-credprovider-1.0.0.jar');
    }

    it('verifies and stages the pinned bundled provider', async () => {
        const tr = runner('success');
        await tr.runAsync();
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_CiJarFromBundled');
        assert.strictEqual(tr.stdout.split('TEST_PROVIDER_JAR_READ').length - 1, 1);
        assert.strictEqual(fs.readFileSync(stagedJar(TestHelpers.stagedRepo(tr)), 'utf-8'), 'approved-provider-jar');
    });

    it('preserves the flat bundled provider filename version fallback', async () => {
        const tr = runner('success');
        delete process.env[TestEnvVars.pluginToolVersion];
        await tr.runAsync();
        TestHelpers.assertSuccess(tr);
        assert.strictEqual(fs.readFileSync(stagedJar(TestHelpers.stagedRepo(tr)), 'utf8'), 'approved-provider-jar');
    });

    it('stages the captured verified bytes even if the bundled JAR is replaced after reading', async () => {
        const tr = runner('snapshot-race');
        await tr.runAsync();
        TestHelpers.assertSuccess(tr);
        const repo = TestHelpers.stagedRepo(tr);
        assert.strictEqual(fs.readFileSync(bundledJar(), 'utf-8'), 'replacement-after-read');
        assert.strictEqual(tr.stdout.split('TEST_PROVIDER_JAR_READ').length - 1, 1);
        assert.strictEqual(fs.readFileSync(stagedJar(repo), 'utf-8'), 'approved-provider-jar');
    });

    it('reverifies the bundle and stages approved bytes instead of trusting previously staged JARs', async () => {
        const first = runner('success');
        await first.runAsync();
        TestHelpers.assertSuccess(first);
        const repo = TestHelpers.stagedRepo(first);
        fs.writeFileSync(stagedJar(repo), 'modified-staged-jar');

        const second = runner('success');
        process.env[TestEnvVars.existingRepoDir] = repo;
        await second.runAsync();
        TestHelpers.assertSuccess(second);
        assert.strictEqual(TestHelpers.stagedRepo(second), repo);
        TestHelpers.assertOutputContains(second, 'TEST_PROVIDER_JAR_READ');
        assert.strictEqual(fs.readFileSync(stagedJar(repo), 'utf-8'), 'approved-provider-jar');
    });

    it('rejects a modified bundled JAR on a later invocation before changing auth configuration', async () => {
        const first = runner('success');
        await first.runAsync();
        TestHelpers.assertSuccess(first);
        const repo = TestHelpers.stagedRepo(first);
        const configPath = path.join(repo, 'azure-artifacts-auth-config.json');
        const originalConfig = fs.readFileSync(configPath);
        fs.writeFileSync(bundledJar(), 'modified-bundled-jar');

        const second = runner('success');
        process.env[TestEnvVars.existingRepoDir] = repo;
        await second.runAsync();
        TestHelpers.assertFailure(second);
        TestHelpers.assertOutputContains(second, 'Error_CiProviderChecksumMismatch');
        TestHelpers.assertOutputDoesNotContain(second, 'Info_AuthConfigWritten');
        assert.deepStrictEqual(fs.readFileSync(configPath), originalConfig);
    });

    for (const scenario of ['invalid-release', 'missing-digest', 'invalid-digest-type']) {
        it(`rejects ${scenario} before reading the bundled JAR`, async () => {
            const tr = runner(scenario);
            await tr.runAsync();
            TestHelpers.assertFailure(tr);
            TestHelpers.assertOutputContains(tr, 'Error_InvalidCiProviderRelease');
            TestHelpers.assertOutputDoesNotContain(tr, 'TEST_PROVIDER_JAR_READ');
            TestHelpers.assertOutputDoesNotContain(tr, 'Info_AuthConfigWritten');
        });
    }

    it('rejects an unexpected bundled JAR even when its adjacent checksum matches', async () => {
        const tr = runner('checksum-mismatch');
        await tr.runAsync();
        TestHelpers.assertFailure(tr);
        TestHelpers.assertOutputContains(tr, 'Error_CiProviderChecksumMismatch');
        TestHelpers.assertOutputDoesNotContain(tr, 'Info_AuthConfigWritten');
        const actualDigest = createHash('sha256').update(fs.readFileSync(bundledJar())).digest('hex');
        assert.strictEqual(fs.readFileSync(`${bundledJar()}.sha256`, 'utf8'), actualDigest);
    });

    for (const [scenario, error] of [
        ['missing-bundle', 'Error_NoCiJarFound'],
        ['missing-jar', 'Error_NoCiJarFound'],
        ['nested-layout', 'Error_NoCiJarFound'],
        ['jar-read-failure', 'test provider read failed'],
    ]) {
        it(`reports ${scenario} without writing auth configuration`, async () => {
            const tr = runner(scenario);
            await tr.runAsync();
            TestHelpers.assertFailure(tr);
            TestHelpers.assertOutputContains(tr, error);
            TestHelpers.assertOutputDoesNotContain(tr, 'Info_AuthConfigWritten');
        });
    }

    it('preserves trusted custom overrides without validating bundled release metadata', async () => {
        const override = process.env['GRADLE_CREDPROVIDER_HOME']!;
        const tr = runner('invalid-release');
        process.env['GRADLE_CREDPROVIDER_HOME'] = override;
        await tr.runAsync();
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_CiJarFromHome');
        TestHelpers.assertOutputDoesNotContain(tr, 'TEST_PROVIDER_JAR_READ');
    });
});

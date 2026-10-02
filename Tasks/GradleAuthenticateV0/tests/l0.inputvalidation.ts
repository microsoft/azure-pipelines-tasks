// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './testconstants';
import { TestHelpers } from './testhelpers';

describe('GradleAuthenticate L0 - Input Validation', function () {
    this.timeout(20000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    it('should fail when neither buildFiles nor repositoryUrl are provided', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        TestHelpers.assertFailure(tr);
        TestHelpers.assertOutputContains(tr, 'Error_NoBuildFilesOrRepoUrls');
    });

    it('should succeed with repositoryUrl only', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
    });

    it('should skip a malformed repositoryUrl', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'not-a-url';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Warning_InvalidRepositoryUrlSkipped');
    });

    it('should skip an HTTP repositoryUrl', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] =
            'http://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Warning_InvalidRepositoryUrlSkipped');
    });

    it('should skip a non-Azure-Artifacts HTTPS repositoryUrl', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://example.com/feed';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Warning_InvalidRepositoryUrlSkipped');
    });

    it('should reject an unsafe plugin version', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] =
            'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0 bad';

        await tr.runAsync();

        TestHelpers.assertFailure(tr);
        TestHelpers.assertOutputContains(tr, 'Error_InvalidPluginVersion');
    });

    it('should reject an unsafe input version when a build-file version is discovered', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-test-'));
        const buildFile = path.join(tempDir, 'settings.gradle');
        fs.writeFileSync(buildFile, `
plugins {
    id 'com.microsoft.azure.artifacts.credprovider' version '1.0.0'
}
repositories {
    maven { url 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1' }
}
`);

        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.buildFiles] = buildFile;
        process.env[TestEnvVars.pluginToolVersion] =
            "1.0.0'; new URL('https://attacker.example').text; //";

        await tr.runAsync();

        fs.rmSync(tempDir, { recursive: true, force: true });

        TestHelpers.assertFailure(tr);
        TestHelpers.assertOutputContains(tr, 'Error_InvalidPluginVersion');
    });

    it('should succeed with buildFiles only', async () => {
        // Create a temp build file containing a feed URL
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-test-'));
        const buildFile = path.join(tempDir, 'settings.gradle');
        fs.writeFileSync(buildFile, `
plugins {
    id 'com.microsoft.azure.artifacts.credprovider' version '1.0.0'
}
dependencyResolutionManagement {
    repositories {
        maven { url 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1' }
    }
}
`);

        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.buildFiles] = buildFile;

        await tr.runAsync();

        fs.rmSync(tempDir, { recursive: true, force: true });

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_DiscoveredFeed');
    });

    it('should skip an HTTP URL discovered from a build file', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-test-'));
        const buildFile = path.join(tempDir, 'settings.gradle');
        fs.writeFileSync(buildFile, `
plugins {
    id 'com.microsoft.azure.artifacts.credprovider' version '1.0.0'
}
repositories {
    maven { url 'http://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1' }
}
`);

        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.buildFiles] = buildFile;

        await tr.runAsync();

        fs.rmSync(tempDir, { recursive: true, force: true });

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Warning_InvalidRepositoryUrlSkipped');
    });

    it('should neutralize logging commands in build-file-derived values', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-test-'));
        const buildFile = path.join(tempDir, 'settings.gradle');
        fs.writeFileSync(buildFile, `
plugins {
    id 'com.microsoft.azure.artifacts.credprovider' version '1.0.0'
}
repositories {
    maven { url 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1##vso[task.setvariable variable=INJECTED]bad' }
}
`);

        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.buildFiles] = buildFile;

        await tr.runAsync();

        fs.rmSync(tempDir, { recursive: true, force: true });

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputDoesNotContain(
            tr,
            '##vso[task.setvariable variable=INJECTED]bad');
        TestHelpers.assertOutputContains(
            tr,
            '##_vso[task.setvariable');
    });
});

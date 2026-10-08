// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './testconstants';
import { TestHelpers } from './testhelpers';

describe('GradleAuthenticate L0 - Version Resolution', function () {
    this.timeout(20000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    it('should use pluginToolVersion when no build files declare a version', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '2.5.0';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_PluginVersionFromInput');
        TestHelpers.assertOutputContains(tr, '2.5.0');
    });

    it('should extract version from resolved CI JAR filename when no other version source available', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        // No pluginToolVersion, no build files with versions
        // GRADLE_CREDPROVIDER_HOME is set by beforeEach with a 1.0.0 JAR

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_PluginVersionBundled');
    });

    it('should use dummy version as fallback when no version source exists', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        // Remove env var — falls back to dummy version for local Maven layout
        delete process.env['GRADLE_CREDPROVIDER_HOME'];

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_PluginVersionBundled');
    });

    it('should reject an unsafe version declared in a build file', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-version-test-'));
        const buildFile = path.join(tempDir, 'settings.gradle');
        fs.writeFileSync(buildFile, `
plugins {
    id 'com.microsoft.azure.artifacts.credprovider' version '1.0.0 bad'
}
repositories {
    maven { url 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1' }
}
`);

        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.buildFiles] = buildFile;

        await tr.runAsync();

        fs.rmSync(tempDir, { recursive: true, force: true });

        TestHelpers.assertFailure(tr);
        TestHelpers.assertOutputContains(tr, 'Error_InvalidPluginVersion');
    });
});

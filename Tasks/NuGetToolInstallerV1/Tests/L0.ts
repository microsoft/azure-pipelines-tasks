import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestHelpers } from './TestHelpers';
import { TestEnvVars } from './TestSetup';

describe('NuGetToolInstallerV1 Suite', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('should install NuGet with specific version', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.versionSpec] = '5.9.0';
        process.env[TestEnvVars.checkLatest] = 'false';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
    });

    it('should install NuGet with default version (>=4.9)', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.checkLatest] = 'false';
        // No versionSpec set - should use default >=4.9

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
    });

    it('should install NuGet with version range', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.versionSpec] = '>=4.0.0 <6.0.0';
        process.env[TestEnvVars.checkLatest] = 'false';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
    });

    it('should install NuGet with checkLatest enabled', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.versionSpec] = '>=4.9';
        process.env[TestEnvVars.checkLatest] = 'true';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
    });

    it('should fail when NuGet download fails', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.versionSpec] = '5.9.0';
        process.env[TestEnvVars.shouldFail] = 'true';
        process.env[TestEnvVars.errorMessage] = 'Unable to download NuGet from specified source';

        await tr.runAsync();

        TestHelpers.assertFailed(tr);
        TestHelpers.assertOutputContains(tr, 'ERR:Unable to download NuGet');
    });

    it('should handle custom NuGet path', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.versionSpec] = '5.9.0';
        process.env[TestEnvVars.nugetPath] = 'c:\\custom\\path\\nuget.exe';
        process.env[TestEnvVars.checkLatest] = 'false';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
    });

    it('should install latest NuGet when checkLatest is true', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.versionSpec] = '>=4.9';
        process.env[TestEnvVars.checkLatest] = 'true';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
    });
});

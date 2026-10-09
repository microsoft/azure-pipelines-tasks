// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './testconstants';
import { TestHelpers } from './testhelpers';

describe('GradleAuthenticate L0 - Authentication', function () {
    this.timeout(20000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    it('should warn when no service connection is configured', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';
        // No service connection set

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Warning_NoServiceConnection');
    });

    it('should not warn when service connection is configured', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';
        process.env[TestEnvVars.adoServiceConnection] = 'test-service-connection-id';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputDoesNotContain(tr, 'Warning_NoServiceConnection');
    });

    it('should write auth config with SAT entry when no service connection', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_AuthConfigWritten');
    });

    it('should write WIF auth entry when service connection is provided', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';
        process.env[TestEnvVars.adoServiceConnection] = 'test-service-connection-id';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_AuthConfigWritten');
        // Verify the WIF path was taken (feed tenant was probed)
        TestHelpers.assertOutputContains(tr, 'Info_FeedResourceTenant');
    });
});

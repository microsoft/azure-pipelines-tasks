// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './testconstants';
import { TestHelpers } from './testhelpers';

describe('GradleAuthenticate L0 - Environment Setup', function () {
    this.timeout(20000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    it('should set ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO and ARTIFACTS_GRADLE_AUTH_CONFIG', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO');
        TestHelpers.assertOutputContains(tr, 'ARTIFACTS_GRADLE_AUTH_CONFIG');
    });

    it('should write init script and report success', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_InitScriptWritten');
        TestHelpers.assertOutputContains(tr, 'Info_SuccessResult');
    });

    it('should lay out Maven repo with correct version', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '3.2.1';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_MavenRepoLaidOut');
        TestHelpers.assertOutputContains(tr, '3.2.1');
    });
});

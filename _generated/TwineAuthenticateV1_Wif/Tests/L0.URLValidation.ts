import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('TwineAuthenticate L0 Suite - Feed URL Handling', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('WIF Feed URL Usage', function() {
        it('authenticates with valid Azure DevOps feed URL', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        });

        it('authenticates with project-scoped feed URL', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'https://pkgs.dev.azure.com/testorg/testproject/_packaging/TestFeed/pypi/upload/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        });
    });
});

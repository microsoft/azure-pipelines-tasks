import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('PipAuthenticate L0 Suite - Feed URL Handling', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('WIF Feed URL Usage', function() {
        for (const feedUrl of [
            'http://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/',
            'ftp://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/',
            '//pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/',
            'not-a-url'
        ]) {
            it(`rejects an insecure or invalid WIF URL: ${feedUrl}`, async () => {
                const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
                process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
                process.env[testConstants.TestEnvVars.feedUrl] = feedUrl;
                process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;

                await tr.runAsync();

                assert(tr.failed);
                assert(tr.errorIssues.some(message => message.includes('requires a valid HTTPS feed URL')));
                assert(!tr.stdout.includes('Mock WIF: getFeedTenantId'));
                assert(!tr.stdout.includes('Mock WIF: getFederatedWorkloadIdentityCredentials'));
                assert(!TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar));
            });
        }

        it('accepts uppercase HTTPS and normalizes it before adding credentials', async () => {
            const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'HTTPS://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            const indexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(indexUrl && new URL(indexUrl).protocol === 'https:');
            assert(!indexUrl.includes('HTTPS://'));
        });

        it('authenticates with valid Azure DevOps feed URL', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            
            // Verify the URL is used correctly
            const pipIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf('pkgs.dev.azure.com') >= 0,
                'PIP_INDEX_URL should contain the Azure DevOps feed URL');
        });

        it('authenticates with project-scoped feed URL', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'https://pkgs.dev.azure.com/testorg/testproject/_packaging/TestFeed/pypi/simple/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });
    });
});

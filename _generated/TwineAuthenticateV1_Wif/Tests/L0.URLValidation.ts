import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('TwineAuthenticate L0 Suite - Feed URL Handling', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('WIF Feed URL Usage', function() {
        for (const feedUrl of [
            'http://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/',
            'ftp://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/',
            '//pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/',
            'not-a-url'
        ]) {
            it(`rejects an insecure or invalid WIF URL: ${feedUrl}`, async () => {
                const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
                process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
                process.env[testConstants.TestEnvVars.feedUrl] = feedUrl;
                process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;

                await tr.runAsync();

                TestHelpers.assertFailure(tr);
                assert(tr.errorIssues.some(message => message.includes('requires a valid HTTPS feed URL')));
                assert(!tr.stdout.includes('Mock WIF: getFeedTenantId'));
                assert(!tr.stdout.includes('Mock WIF: getFederatedWorkloadIdentityCredentials'));
                TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pypircPathVar);
                assert(!fs.existsSync(path.join(__dirname, 'temp', '.pypirc')));
            });
        }

        it('accepts uppercase HTTPS and writes a normalized HTTPS repository', async () => {
            const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'HTTPS://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            const content = fs.readFileSync(path.join(__dirname, 'temp', '.pypirc'), 'utf8');
            assert(content.includes('repository=https://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/'));
            assert(content.includes(testConstants.TestData.wifToken));
        });

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

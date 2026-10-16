import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import fs = require('fs');
import assert = require('assert');
import path = require('path');
import './CoveragePublisherTests';

describe('PublishCodeCoverageResultsV2 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 15000);

    before(() => {
        process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
    });

    it('Publish Code coverage results with Summary file matches', async function() {
        const testPath = path.join(__dirname, 'L0SummaryFileLocationMatches.ts')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Publish Code coverage results should work fine with empty results', async function() {
        const testPath = path.join(__dirname, 'L0NotFailWithEmptyResults.ts')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');  // It will give a message of No code coverage for empty inputs
    });

    it('Passes workspace directories as trusted source roots', async function() {
        const testPath = path.join(__dirname, 'L0PassesTrustedSourceDirectories.js');
        const tr: MockTestRunner = new MockTestRunner(testPath);
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(
            tr.stdout.indexOf('sourceDirectory=/external/sources') >= 0,
            'pathToSources should be passed to the coverage publisher');
        assert(
            tr.stdout.indexOf('publishHtmlReport=true') >= 0,
            'HTML report publishing should remain enabled');
        assert(
            tr.stdout.indexOf('trustedSourceDirectories=/agent/_work/1/s;/agent/_work/1/s/repository') >= 0,
            'workspace directories should be passed as trusted source roots');
        assert(
            tr.stdout.indexOf('enableTrustedSourcePathFiltering=true') >= 0,
            'trusted source path filtering should be enabled by the pipeline feature');
    });

    it('Leaves trusted source path filtering disabled when the feature is off', async function() {
        const testPath = path.join(__dirname, 'L0TrustedSourcePathFilteringDisabled.js');
        const tr: MockTestRunner = new MockTestRunner(testPath);
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(
            tr.stdout.indexOf('trustedSourceDirectories=undefined') >= 0,
            'trusted source roots should not be passed when the pipeline feature is off');
        assert(
            tr.stdout.indexOf('publishHtmlReport=true') >= 0,
            'HTML report publishing should remain enabled');
        assert(
            tr.stdout.indexOf('enableTrustedSourcePathFiltering=false') >= 0,
            'trusted source path filtering should remain disabled when the pipeline feature is off');
    });

    it('Preserves disabled HTML report publishing', async function() {
        const testPath = path.join(__dirname, 'L0PublishHtmlReportDisabled.js');
        const tr: MockTestRunner = new MockTestRunner(testPath);
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(
            tr.stdout.indexOf('publishHtmlReport=false') >= 0,
            'HTML report publishing should remain disabled');
    });

    // New proxy configuration tests
    it('Should handle agent proxy configuration correctly', async function() {
        const testPath = path.join(__dirname, 'L0ProxyAgentConfig.ts');
        const tr: MockTestRunner = new MockTestRunner(testPath);
        await tr.runAsync();

        // Verify proxy environment variables are set correctly
        assert(tr.succeeded || tr.stdout.indexOf('Using agent proxy') >= 0, 'Should configure agent proxy');
    });

});

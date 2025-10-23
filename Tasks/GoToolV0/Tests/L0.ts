import * as path from "path";
import * as assert from "assert";
import { MockTestRunner } from "azure-pipelines-task-lib/mock-test";
import tl = require('azure-pipelines-task-lib');

describe('GoToolV0 Suite', function() {
    this.timeout(60000);

    before((done) => {
        done();
    });

    after(function () {
        // Cleanup if needed
    });

    it('Should generate correct download URL with new go.dev domain', async () => {
        let tp = path.join(__dirname, 'L0UrlGeneration.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('https://go.dev/dl/go1.21.3'), 'Should use new go.dev/dl URL');
    });

    it('Should handle Microsoft download source correctly', async () => {
        let tp = path.join(__dirname, 'L0CustomBaseUrl.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('https://aka.ms/golang/release/latest/go1.21.3'), 'Should use Microsoft download URL');
    });

    it('Should resolve latest patch version for major.minor input', async () => {
        let tp = path.join(__dirname, 'L0VersionResolution.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('Resolved version 1.21 to 1.21.5'), 'Should resolve to latest patch');
    });

    it('Should set environment variables correctly', async () => {
        let tp = path.join(__dirname, 'L0EnvironmentVariables.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('##vso[task.setvariable variable=GOROOT'), 'Should set GOROOT');
        assert(tr.stdOutContained('##vso[task.setvariable variable=GOPATH'), 'Should set GOPATH');
        assert(tr.stdOutContained('##vso[task.setvariable variable=GOBIN'), 'Should set GOBIN');
    });

    it('Should generate correct filename for different platforms', async () => {
        let tp = path.join(__dirname, 'L0CrossPlatformFilename.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('Windows: go1.21.3.windows-amd64.zip') || 
               tr.stdOutContained('Linux: go1.21.3.linux-amd64.tar.gz') ||
               tr.stdOutContained('Darwin: go1.21.3.darwin-amd64.tar.gz'), 'Should generate correct platform-specific filename');
    });

    it('Should use cached version when available', async () => {
        let tp = path.join(__dirname, 'L0CachedVersion.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('Found cached Go version'), 'Should use cached version');
        assert(!tr.stdOutContained('Downloading Go from'), 'Should not download when cached');
    });

    it('Should download and install Go successfully', async () => {
        let tp = path.join(__dirname, 'L0InstallSuccess.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('Downloading Go from'), 'Should download Go');
        assert(tr.stdOutContained('Go tool is available'), 'Should report success');
    });

    it('Should fail with invalid version input', async () => {
        let tp = path.join(__dirname, 'L0InvalidVersion.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('Input \'version\' is required'), 'Should show validation error');
    });

    it('Should fail when Agent.TempDirectory is not set', async () => {
        let tp = path.join(__dirname, 'L0TempDirNotSet.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('Expected Agent.TempDirectory to be set'), 'Should show temp directory error');
    });

    it('Should fail on download errors', async () => {
        let tp = path.join(__dirname, 'L0DownloadFailure.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('Failed to download version'), 'Should show download failure');
    });
});

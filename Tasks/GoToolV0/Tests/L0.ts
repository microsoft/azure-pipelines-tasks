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

    // Official Go (go.dev) tests
    it('Should install official Go with full patch version', async () => {
        let tp = path.join(__dirname, 'L0OfficialGoPatch.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('https://go.dev/dl/go1.22.3'), 'Should use official Go storage URL');
        assert(tr.stdOutContained('Caching tool: go version: 1.22.3'), 'Should cache with toolName "go"');
    });

    it('Should resolve official Go major.minor to latest patch', async () => {
        let tp = path.join(__dirname, 'L0OfficialGoMinor.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('Resolved 1.21 to 1.21.5'), 'Should resolve to latest patch via go.dev API');
        assert(tr.stdOutContained('https://go.dev/dl/go1.21.5'), 'Should download resolved version');
    });

    // Microsoft Go (aka.ms) tests
    it('Should install Microsoft Go with major.minor version', async () => {
        let tp = path.join(__dirname, 'L0MicrosoftGoMinor.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('https://aka.ms/golang/release/latest/go1.25.0'), 'Should use Microsoft aka.ms URL');
        assert(tr.stdOutContained('Caching tool: go-aka version: 1.25.0'), 'Should cache with toolName "go-aka"');
    });

    it('Should install Microsoft Go with patch version', async () => {
        let tp = path.join(__dirname, 'L0MicrosoftGoPatch.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('https://aka.ms/golang/release/latest/go1.24.7'), 'Should use Microsoft URL');
        assert(tr.stdOutContained('Caching tool: go-aka version: 1.24.7-2'), 'Should resolve to latest revision from manifest');
    });

    it('Should install Microsoft Go with revision format', async () => {
        let tp = path.join(__dirname, 'L0MicrosoftGoRevision.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('https://aka.ms/golang/release/latest/go1.24.7-1'), 'Should use exact revision');
        assert(tr.stdOutContained('Caching tool: go-aka version: 1.24.7-1'), 'Should cache with specified revision');
    });

    // Caching tests
    it('Should use cached official Go version', async () => {
        let tp = path.join(__dirname, 'L0CachedOfficial.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('Found cached tool: go version 1.22.3'), 'Should find cached version');
        assert(!tr.stdOutContained('Downloading Go from'), 'Should not download when cached');
    });

    it('Should use cached Microsoft Go version', async () => {
        let tp = path.join(__dirname, 'L0CachedMicrosoft.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('Found cached tool: go-aka version 1.25.0'), 'Should find cached Microsoft build');
        assert(!tr.stdOutContained('Downloading Go from'), 'Should not download when cached');
    });

    // Environment variable tests
    it('Should set environment variables correctly', async () => {
        let tp = path.join(__dirname, 'L0EnvironmentVariables.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('##vso[task.setvariable variable=GOROOT'), 'Should set GOROOT');
        assert(tr.stdOutContained('##vso[task.setvariable variable=GOPATH'), 'Should set GOPATH');
        assert(tr.stdOutContained('##vso[task.setvariable variable=GOBIN'), 'Should set GOBIN');
    });

    // Cross-platform tests
    it('Should generate correct filename for Windows', async () => {
        let tp = path.join(__dirname, 'L0FilenameWindows.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('go1.22.3.windows-amd64.zip'), 'Should generate Windows zip filename');
    });

    it('Should generate correct filename for Linux', async () => {
        let tp = path.join(__dirname, 'L0FilenameLinux.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('go1.22.3.linux-amd64.tar.gz'), 'Should generate Linux tar.gz filename');
    });

    it('Should generate correct filename for Darwin/macOS', async () => {
        let tp = path.join(__dirname, 'L0FilenameDarwin.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('go1.22.3.darwin-amd64.tar.gz'), 'Should generate Darwin tar.gz filename');
    });

    it('Should generate correct filename for ARM64 architecture', async () => {
        let tp = path.join(__dirname, 'L0FilenameArm64.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.succeeded, 'Should have succeeded');
        assert(tr.stdOutContained('go1.22.3.linux-arm64.tar.gz'), 'Should generate ARM64 filename');
    });

    // Error handling tests
    it('Should fail with empty version input', async () => {
        let tp = path.join(__dirname, 'L0InvalidVersionEmpty.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('Input required: version'), 'Should show validation error');
    });

    it('Should fail with null version input', async () => {
        let tp = path.join(__dirname, 'L0InvalidVersionNull.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('Input \'version\' is required'), 'Should reject null version');
    });

    it('Should fail with undefined version input', async () => {
        let tp = path.join(__dirname, 'L0InvalidVersionUndefined.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('Input \'version\' is required'), 'Should reject undefined version');
    });

    it('Should fail with unsupported base URL', async () => {
        let tp = path.join(__dirname, 'L0InvalidBaseUrl.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('Invalid download URL'), 'Should reject unsupported URLs');
    });

    it('Should fail with invalid version format for official Go', async () => {
        let tp = path.join(__dirname, 'L0InvalidVersionFormat.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('Official Go version must be'), 'Should reject invalid version format');
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

    it('Should fail when go.dev API returns no matching version', async () => {
        let tp = path.join(__dirname, 'L0NoMatchingVersion.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('has no stable patch release yet'), 'Should indicate no stable release');
    });
});

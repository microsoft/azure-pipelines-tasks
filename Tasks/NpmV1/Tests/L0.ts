import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import * as npmToolRunnerModule from '../npmtoolrunner';

class MockedTask {
    private _proxyUrl: string;
    private _proxyUsername: string;
    private _proxyPassword: string;
    private _proxyBypass: string;
    private _secret: string;
    private _execSyncCalls: { args: string; options: tr.IExecSyncOptions }[] = [];

    public debug(message: string) {}
    public loc(message: string): string { return message; }

    public setMockedValues(proxyUrl?: string, proxyUsername?: string, proxyPassword?: string, proxyBypass?: string) {
        this._proxyUrl = proxyUrl;
        this._proxyUsername = proxyUsername;
        this._proxyPassword = proxyPassword;
        this._proxyBypass = proxyBypass;
        this._secret = '';
        this._execSyncCalls = [];
    }

    public getVariable(name: string) {
        switch (name.toLowerCase()) {
            case "agent.proxyurl":
                return this._proxyUrl;
            case "agent.proxyusername":
                return this._proxyUsername;
            case "agent.proxypassword":
                return this._proxyPassword;
            case "agent.proxybypasslist":
                return this._proxyBypass;
            case "task.displayname":
                return "Npm Test"
            default:
                return undefined;
        }
    }

    public setSecret(secret: string) {
        this._secret = secret;
    }

    public getSecret(): string {
        return this._secret;
    }

    public setResourcePath(s: string){
        
    }

    public stats(path: string) {
        return { isDirectory: () => true };
    }

    public getBoolInput(name: string, required: boolean): boolean {
        return false;
    }

    public execSync(tool: string, args: string, options: tr.IExecSyncOptions): tr.IExecSyncResult {
        this._execSyncCalls.push({ args, options });
        return {
            code: 0,
            stdout: args === 'config get cache' ? 'C:\\npm-cache' : '',
            stderr: ''
        } as tr.IExecSyncResult;
    }

    public getExecSyncCalls(): { args: string; options: tr.IExecSyncOptions }[] {
        return this._execSyncCalls;
    }
}

function createMockTestRunner(testPath: string): ttm.MockTestRunner {
    const runner = new ttm.MockTestRunner(testPath);
    runner.nodePath = process.execPath;
    return runner;
}

describe('Npm Toolrunner', function () {

    var mockedTask: MockedTask = new MockedTask();
    var mockedProxy: string = "http://proxy/";
    var mockedUsername: string = "mockedUsername";
    var mockedPassword: string = "mockedPassword#";

    beforeEach(() => {
        npmToolRunnerModule.__setTaskLibForTesting(mockedTask as any);
    });

    afterEach(() => {
        npmToolRunnerModule.__setTaskLibForTesting(require('azure-pipelines-task-lib/task'));
    });

    it("No HTTP_PROXY", (done: MochaDone) => {
        mockedTask.setMockedValues();
        let httpProxy: string = npmToolRunnerModule.NpmToolRunner._getProxyFromEnvironment();
        assert.strictEqual(httpProxy, undefined);

        done();
    });

    it("gets proxy without auth", (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy);
        let httpProxy: string = npmToolRunnerModule.NpmToolRunner._getProxyFromEnvironment();
        assert.strictEqual(httpProxy, mockedProxy);

        done();
    });

    it("registers the proxy uri with a password as a secret", (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy, mockedUsername, mockedPassword);
        let httpProxy: string = npmToolRunnerModule.NpmToolRunner._getProxyFromEnvironment();
        let expected = `http://${mockedUsername}:${encodeURIComponent(mockedPassword)}@proxy/`;
        assert.strictEqual(httpProxy, expected);
        assert.strictEqual(mockedTask.getSecret(), expected);
        
        done();
    });

    it('isolates npm environment changes and filters displayed child output', () => {
        const variableName = 'NPM_CONFIG_USERCONFIG';
        const originalValue = process.env[variableName];

        try {
            delete process.env[variableName];
            mockedTask.setMockedValues();

            const runner = new npmToolRunnerModule.NpmToolRunner('C:\\work', 'C:\\temp\\.npmrc', false);
            const preparedOptions = runner._prepareNpmEnvironment({});

            assert.strictEqual(process.env[variableName], undefined, 'process.env should not be modified');
            assert.notStrictEqual(preparedOptions.env, process.env, 'npm should receive a cloned environment');
            assert.strictEqual(preparedOptions.env[variableName], 'C:\\temp\\.npmrc');
            assert.deepStrictEqual(preparedOptions.externalOutput, { source: 'childProcess' });

            const silentCalls = mockedTask.getExecSyncCalls()
                .filter(call => call.options.silent === true);
            assert(silentCalls.length > 0, 'silent npm probes should run');
            silentCalls.forEach(call => {
                assert.deepStrictEqual(
                    call.options.externalOutput,
                    { source: 'childProcess' },
                    'silent parsed output should also use sanitized execution options');
            });
        } finally {
            if (originalValue === undefined) {
                delete process.env[variableName];
            } else {
                process.env[variableName] = originalValue;
            }
        }
    });
});

describe('Npm Task', function () {
    this.timeout(6000);

    it('restricts logging commands and disallows setting variables', () => {
        const task = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'task.json'), 'utf8'));

        assert.deepStrictEqual(task.restrictions, {
            commands: { mode: 'restricted' },
            settableVariables: { allowed: [] }
        });
    });

    // npm failure dumps log
    it('npm failure dumps debug log from npm cache', async () => {
        const debugLog = 'NPM_DEBUG_LOG';

        let tp = path.join(__dirname, 'npm-failureDumpsLog-cacheDir.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained(debugLog));
        assert(tr.stdOutContained('##_vso[task.setvariable variable=NODE_OPTIONS]'), 'debug log command should be neutralized');
        assert(!tr.stdOutContained('##vso[task.setvariable variable=NODE_OPTIONS]'), 'debug log command should not be executable');
    });

    it('failing npm ci dumps a sanitized debug log from working directory', async () => {
        this.timeout(3000);
        const debugLog = 'NPM_DEBUG_LOG';

        let tp = path.join(__dirname, 'npm-failureDumpsLog-workingDir.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained(debugLog));
        assert(tr.stdOutContained('##_vso[task.setvariable variable=NODE_OPTIONS]'), 'debug log command should be neutralized');
        assert(!tr.stdOutContained('##vso[task.setvariable variable=NODE_OPTIONS]'), 'debug log command should not be executable');
    });

    it('neutralizes a lockfile-sourced deprecated warning without registry access', async () => {
        const tp = path.join(__dirname, 'ci-lockfileDeprecated.js');
        const tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert(tr.succeeded, 'npm ci should have succeeded');
        assert(tr.stdErrContained('##_vso[task.prependpath]/tmp/lockfile'), 'lockfile payload should be neutralized');
        assert(!tr.stdErrContained('##vso[task.prependpath]/tmp/lockfile'), 'lockfile payload should not be executable');
    });

    it('neutralizes a registry-sourced deprecated warning', async () => {
        const tp = path.join(__dirname, 'install-registryDeprecated.js');
        const tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert(tr.succeeded, 'npm install should have succeeded');
        assert(
            tr.stdErrContained('##_vso[task.setendpoint id=SystemVssConnection;field=url]'),
            'registry payload should be neutralized');
        assert(
            !tr.stdErrContained('##vso[task.setendpoint id=SystemVssConnection;field=url]'),
            'registry payload should not be executable');
    });

    // custom
    it('custom command succeeds with single service endpoint', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'custom-singleEndpoint.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('npm custom successful'), 'npm custom command should have run');
        assert(tr.stdOutContained('http://example.com/1/'), 'debug output should have contained endpoint');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('custom command should return npm version', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'custom-version.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tr.invokedToolCount, 2, 'task should have run npm');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('; debug cli configs'), 'should have debug npm config output');
        assert(tr.stdOutContained('; cli configs') === false, 'should not have regular npm config output');
        assert(tr.stdOutContained('##_vso[task.setvariable variable=NODE_OPTIONS]'), 'npm output command should be neutralized');
        assert(!tr.stdOutContained('##vso[task.setvariable variable=NODE_OPTIONS]'), 'npm output command should not be executable');
        assert(tr.stdErrContained('##_vso[task.prependpath]/tmp/malicious'), 'npm stderr command should be neutralized');
        assert(!tr.stdErrContained('##vso[task.prependpath]/tmp/malicious'), 'npm stderr command should not be executable');
    });

    // show config
    it('should execute \'npm config list\' without debug switch', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'config-noDebug.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tr.invokedToolCount, 2, 'task should have run npm');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('; cli configs'), 'should have regular npm config output');
        assert(tr.stdOutContained('; debug cli configs') === false, 'should not have debug npm config output');
    });

    // install command
    it('should fail when npm fails', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-npmFailure.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
    });

    it ('install using local feed', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-feed.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tr.invokedToolCount, 2, 'task should have run npm');
        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'install from feed shoud override project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'install from .npmrc shoud restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it ('install using local project-scoped feed', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-project-scoped-feed.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tr.invokedToolCount, 2, 'task should have run npm');
        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'install from feed shoud override project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'install from .npmrc shoud restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it ('install using npmrc', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-npmrc.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tr.invokedToolCount, 2, 'task should have run npm');
        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(!tr.stdOutContained('OverridingProjectNpmrc'), 'install from .npmrc shoud not override project .npmrc');
        assert(!tr.stdOutContained('RestoringProjectNpmrc'), 'install from .npmrc shoud not restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('install using multiple endpoints', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-multipleEndpoints.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(tr.stdOutContained('http://example.com/1/'), 'debug output should have contained endpoint');
        assert(tr.stdOutContained('http://example.com/2/'), 'debug output should have contained endpoint');
        assert(tr.succeeded, 'task should have succeeded');
    });

    // publish
    it ('publish using feed', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'publish-feed.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tr.invokedToolCount, 2, 'task should have run npm');
        assert(tr.stdOutContained('npm publish successful'), 'npm should have published the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'publish should always ooverrideverride project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'publish should always restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it ('publish using project-scoped feed', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'publish-project-scoped-feed.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tr.invokedToolCount, 2, 'task should have run npm');
        assert(tr.stdOutContained('npm publish successful'), 'npm should have published the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'publish should always ooverrideverride project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'publish should always restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it ('publish using external registry', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'publish-external.js');
        let tr = createMockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tr.invokedToolCount, 2, 'task should have run npm');
        assert(tr.stdOutContained('npm publish successful'), 'npm should have published the package');
        assert(tr.succeeded, 'task should have succeeded');
    });
});
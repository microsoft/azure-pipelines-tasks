import * as assert from 'assert';
import * as path from 'path';
import * as mockery from 'mockery';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

class MockedTask {
    private _proxyUrl: string;
    private _proxyUsername: string;
    private _proxyPassword: string;
    private _proxyBypass: string;
    private _secret: string;

    public debug(message: string) {}
    public loc(message: string): string { return message; }

    public setMockedValues(proxyUrl?: string, proxyUsername?: string, proxyPassword?: string, proxyBypass?: string) {
        this._proxyUrl = proxyUrl;
        this._proxyUsername = proxyUsername;
        this._proxyPassword = proxyPassword;
        this._proxyBypass = proxyBypass;
        this._secret = '';
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
}

describe('Npm Toolrunner', function () {

    var mockedTask: MockedTask = new MockedTask();
    var mockedProxy: string = "http://proxy/";
    var mockedUsername: string = "mockedUsername";
    var mockedPassword: string = "mockedPassword#";
    var e = mockery.registerMock("azure-pipelines-task-lib/task", mockedTask);

    beforeEach(() => {
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
    });

    afterEach(() => {
        mockery.disable();
    });

    it("No HTTP_PROXY", (done: MochaDone) => {
        mockedTask.setMockedValues();
        let npmToolRunner = require("../npmtoolrunner");

        let httpProxy: string = npmToolRunner.NpmToolRunner._getProxyFromEnvironment();
        assert.strictEqual(httpProxy, undefined);

        done();
    });

    it("gets proxy without auth", (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy);
        let npmToolRunner = require("../npmtoolrunner");

        let httpProxy: string = npmToolRunner.NpmToolRunner._getProxyFromEnvironment();
        assert.strictEqual(httpProxy, mockedProxy);

        done();
    });

    it("registers the proxy uri with a password as a secret", (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy, mockedUsername, mockedPassword);
        let npmToolRunner = require("../npmtoolrunner");

        let httpProxy: string = npmToolRunner.NpmToolRunner._getProxyFromEnvironment();
        let expected = `http://${mockedUsername}:${encodeURIComponent(mockedPassword)}@proxy/`;
        assert.strictEqual(httpProxy, expected);
        assert.strictEqual(mockedTask.getSecret(), expected);
        
        done();
    });
});

describe('Npm Task', function () {
    this.timeout(6000);
    before(() => {
        mockery.disable(); // needed to ensure that we can mock vsts-task-lib/task
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        } as mockery.MockeryEnableArgs);
    });

    after(() => {
        mockery.disable();
    });

    beforeEach(() => {
        mockery.resetCache();
    });

    afterEach(() => {
        mockery.deregisterAll();
    });

    // npm failure dumps log
    it('npm failure dumps debug log from npm cache', (done: MochaDone) => {
        const debugLog = 'NPM_DEBUG_LOG';

        let tp = path.join(__dirname, 'npm-failureDumpsLog-cacheDir.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained(debugLog));

        done();
    });

    it('npm failure dumps debug log from working directory', (done: MochaDone) => {
        this.timeout(3000);
        const debugLog = 'NPM_DEBUG_LOG';

        let tp = path.join(__dirname, 'npm-failureDumpsLog-workingDir.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained(debugLog));

        done();
    });

    // custom
    it('custom command succeeds with single service endpoint', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'custom-singleEndpoint.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('npm custom successful'), 'npm custom command should have run');
        assert(tr.stdOutContained('http://example.com/1/'), 'debug output should have contained endpoint');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('custom command should return npm version', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'custom-version.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('; debug cli configs'), 'should have debug npm config output');
        assert(tr.stdOutContained('; cli configs') === false, 'should not have regular npm config output');

        done();
    });

    // show config
    it('should execute \'npm config list\' without debug switch', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'config-noDebug.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('; cli configs'), 'should have regular npm config output');
        assert(tr.stdOutContained('; debug cli configs') === false, 'should not have debug npm config output');

        done();
    });

    // install command
    it('should fail when npm fails', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-npmFailure.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');

        done();
    });

    it ('install using local feed', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-feed.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'install from feed shoud override project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'install from .npmrc shoud restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it ('install using local project-scoped feed', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-project-scoped-feed.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'install from feed shoud override project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'install from .npmrc shoud restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it ('install using npmrc', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-npmrc.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(!tr.stdOutContained('OverridingProjectNpmrc'), 'install from .npmrc shoud not override project .npmrc');
        assert(!tr.stdOutContained('RestoringProjectNpmrc'), 'install from .npmrc shoud not restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('install using multiple endpoints', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-multipleEndpoints.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(tr.stdOutContained('http://example.com/1/'), 'debug output should have contained endpoint');
        assert(tr.stdOutContained('http://example.com/2/'), 'debug output should have contained endpoint');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    // publish
    it ('publish using feed', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'publish-feed.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm publish successful'), 'npm should have published the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'publish should always ooverrideverride project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'publish should always restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it ('publish using project-scoped feed', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'publish-project-scoped-feed.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm publish successful'), 'npm should have published the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'publish should always ooverrideverride project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'publish should always restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it ('publish using external registry', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'publish-external.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm publish successful'), 'npm should have published the package');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
});

import * as path from 'path';
import * as assert from 'assert';
import * as ma from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';
import * as ttm from 'vsts-task-lib/mock-test';
import * as mockery from 'mockery';

class MockedTask {
    private _proxyUrl: string;
    private _proxyUsername: string;
    private _proxyPassword: string;

    public setMockedValues(proxyUrl?: string, proxyUsername?: string, proxyPassword?: string) {
        this._proxyUrl = proxyUrl;
        this._proxyUsername = proxyUsername;
        this._proxyPassword = proxyPassword;
    }

    public getVariable(name: string) {
        switch (name) {
            case "agent.proxyurl":
                return this._proxyUrl;
            case "agent.proxyusername":
                return this._proxyUsername;
            case "agent.proxypassword":
                return this._proxyPassword;
            default:
                return undefined;
        }
    }
}

var mockedTask: MockedTask = new MockedTask();
var mockedProxy: string = 'http://proxy/';
var mockedUsername: string = 'mockedUsername';
var mockedPassword: string = 'mockedPassword';
mockery.registerMock('vsts-task-lib/task', mockedTask);

describe('nuget-task-common Task Suite', function () {
    before(() => {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    after(() => {
        mockery.disable();
    });

    it('No HTTP_PROXY', (done:MochaDone) => {
        mockedTask.setMockedValues();
        let ngToolRunner = require('../NuGetToolRunner');

        let httpProxy: string = ngToolRunner.getNuGetProxyFromEnvironment();
        assert.strictEqual(httpProxy, undefined);

        done();
    });

    it('Finds HTTP_PROXY', (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy);
        let ngToolRunner = require('../NuGetToolRunner');

        let httpProxy: string = ngToolRunner.getNuGetProxyFromEnvironment();
        assert.strictEqual(httpProxy, mockedProxy);

        done();
    });

    it('Finds HTTP_PROXYUSERNAME', (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy, mockedUsername);
        let ngToolRunner = require('../NuGetToolRunner');

        let httpProxy: string = ngToolRunner.getNuGetProxyFromEnvironment();
        assert.strictEqual(httpProxy, `http://${mockedUsername}@proxy/`);

        done();
    });

    it('Finds HTTP_PROXYPASSWORD', (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy, mockedUsername, mockedPassword);
        let ngToolRunner = require('../NuGetToolRunner');

        let httpProxy: string = ngToolRunner.getNuGetProxyFromEnvironment();
        assert.strictEqual(httpProxy, `http://${mockedUsername}:${mockedPassword}@proxy/`);

        done();
    });
});

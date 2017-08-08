import * as path from 'path';
import * as assert from 'assert';
import * as ma from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';
import * as ttm from 'vsts-task-lib/mock-test';
import * as mockery from 'mockery';
import { INuGetXmlHelper } from '../INuGetXmlHelper';

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

    it('NuGetXmlHelper adds source to NuGetConfig', (done: MochaDone) => {
        let configFile: string;
        mockery.registerMock('fs', {
            readFileSync: () => configFile,
            writeFileSync: (path, content) => { configFile = content; }
        });

        let nugetXmlHelper = require('../NuGetXmlHelper');
        let helper: INuGetXmlHelper = new nugetXmlHelper.NuGetXmlHelper();

        configFile = '<configuration/>';
        helper.AddSourceToNuGetConfig('SourceName', 'http://source/');
        assert.strictEqual(
            configFile,
            '<configuration><packageSources><add key="SourceName" value="http://source/"/></packageSources></configuration>',
            'Helper should have added the "SourceName" source');

        helper.AddSourceToNuGetConfig('SourceCredentials', 'http://credentials', 'foo', 'bar');
        assert.strictEqual(
            configFile,
            '<configuration><packageSources><add key="SourceName" value="http://source/"/><add key="SourceCredentials" value="http://credentials"/></packageSources><packageSourceCredentials><SourceCredentials><add key="Username" value="foo"/><add key="ClearTextPassword" value="bar"/></SourceCredentials></packageSourceCredentials></configuration>',
            'Helper should have added the "SourceCredentials" source with credentials');

        helper.RemoveSourceFromNuGetConfig('SourceCredentials');
        assert.strictEqual(
            configFile,
            '<configuration><packageSources><add key="SourceName" value="http://source/"/></packageSources><packageSourceCredentials/></configuration>',
            'Helper should have removed the "SourceCredentials" source and its credentials');

        assert.throws(() => helper.SetApiKeyInNuGetConfig('http://ApiKeySource/', 'ApiKey'), 'SetApiKey should throw as it is not currently supported');

        done();
    });
});

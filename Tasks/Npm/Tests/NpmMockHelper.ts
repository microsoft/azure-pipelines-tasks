import * as path from 'path';

import { TaskLibAnswers, TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';
import { TaskMockRunner } from 'vsts-task-lib/mock-run';
import * as mtr from 'vsts-task-lib/mock-toolrunner';

export class NpmMockHelper extends TaskMockRunner {
    private static NpmCmdPath: string = 'c:\\mock\\location\\npm';
    private static AgentBuildDirectory: string = 'c:\\mock\\agent\\work\\build';
    private static BuildBuildId: string = '12345';
    private static CollectionUrl: string = 'https://example.visualstudio.com/defaultcollection';

    public answers: TaskLibAnswers = {
        checkPath: {},
        exec: {},
        exist: {},
        rmRF: {},
        which: {}
    };

    constructor(taskPath: string) {
        super(taskPath);

        this.registerMock('vsts-task-lib/toolrunner', mtr);
        this.setAnswers(this.answers);

        NpmMockHelper._setVariable('Agent.HomeDirectory', 'c:\\agent\\home\\directory');
        NpmMockHelper._setVariable('Build.SourcesDirectory', 'c:\\agent\\home\\directory\\sources');
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = '{"parameters":{"AccessToken":"token"},"scheme":"OAuth"}';
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = NpmMockHelper.CollectionUrl;
        NpmMockHelper._setVariable('System.DefaultWorkingDirectory', 'c:\\agent\\home\\directory');
        NpmMockHelper._setVariable('System.TeamFoundationCollectionUri', 'https://example.visualstudio.com/defaultcollection');
        NpmMockHelper._setVariable('Agent.BuildDirectory', NpmMockHelper.AgentBuildDirectory);
        NpmMockHelper._setVariable('Build.BuildId', NpmMockHelper.BuildBuildId);
        this.setDebugState(false);

        this._mockNpmConfigList();
        this._setToolPath('npm', NpmMockHelper.NpmCmdPath);
        this.answers.rmRF[path.join(NpmMockHelper.AgentBuildDirectory, 'npm', `${NpmMockHelper.BuildBuildId}.npmrc`)] = { success: true };
        this.answers.rmRF[path.join(NpmMockHelper.AgentBuildDirectory, 'npm')] = { success: true };
    }

    public run(noMockTask?: boolean): void {
        super.run(noMockTask);
    }

    public setDebugState(debug: boolean): void {
        NpmMockHelper._setVariable('System.Debug', debug ? 'true' : 'false');
    }

    public setOsType(osTypeVal : string) {
        if (!this.answers['osType']) {
            this.answers['osType'] = {};
        }

        this.answers['osType']['osType'] = osTypeVal;
    }

    private static _setVariable(name: string, value: string): void {
        let key = NpmMockHelper._getVariableKey(name);
        process.env[key] = value;
    }

    private static _getVariableKey(name: string): string {
        return name.replace(/\./g, '_').toUpperCase();
    }

    public setExecResponse(command: string, result: TaskLibAnswerExecResult) {
        this.answers.exec[command] = result;
    }

    public RegisterLocationServiceMocks() {
        this.registerMock('vso-node-api/WebApi', {
            getBearerHandler: function(token){
                return {};
            },
            WebApi: function(url, handler){
                return {
                    getCoreApi: function() {
                        return {
                            vsoClient: {
                                getVersioningData: function (ApiVersion: string, PackagingAreaName: string, PackageAreaId: string, Obj) {
                                    return { requestUrl: 'foobar' };
                                }
                            }
                        };
                    }
                };
            }
        });
    }

    public mockServiceEndpoint(endpointId: string, url: string, auth: any): void {
        process.env['ENDPOINT_URL_' + endpointId] = url;
        process.env['ENDPOINT_AUTH_' + endpointId] = JSON.stringify(auth);
    }

    private isDebugging() {
        let value = process.env[NpmMockHelper._getVariableKey('System.Debug')];
        return value === 'true';
    }

    private _setToolPath(tool: string, path: string) {
        this.answers.which[tool] = path;
        this.answers.checkPath[path] = true;
    }

    private _mockNpmConfigList() {
        this.setExecResponse(`${NpmMockHelper.NpmCmdPath} config list`, {
            code: 0,
            stdout: '; cli configs'} as TaskLibAnswerExecResult);

        this.setExecResponse(`${NpmMockHelper.NpmCmdPath} config list -l`, {
            code: 0,
            stdout: '; debug cli configs'} as TaskLibAnswerExecResult);
    }

    private _registerMockToolRunner() {
        let tmr = require('vsts-task-lib/mock-toolrunner');
        this.registerMock('vsts-task-lib/toolrunner', tmr);
    }

    private _mockGetFeedRegistryUrl(feedId: string): string {
        return NpmMockHelper.CollectionUrl + '/_packaging/' + feedId + '/npm/registry/';
    }
}

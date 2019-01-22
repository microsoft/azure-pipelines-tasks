import { TaskLibAnswers, TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';
import tmrm = require('vsts-task-lib/mock-run');
import * as pkgMock from 'packaging-common/Tests/MockHelper';

export class UniversalMockHelper {
    private static ArtifactToolCmd: string = 'c:\\mock\\location\\ArtifactTool.exe';

    public answers: TaskLibAnswers = {
        checkPath: {},
        exec: {},
        exist: {},
        findMatch: {},
        rmRF: {},
        which: {
            'c:\\mock\\location\\ArtifactTool.exe': UniversalMockHelper.ArtifactToolCmd
        }
    };

    constructor(private tmr: tmrm.TaskMockRunner) {
        this.tmr.setInput('verbosity', "verbose");

        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources",
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_SERVERTYPE'] = "hosted";

        this.tmr.setAnswers(this.answers);

        this.registerArtifactToolUtilitiesMock();
        this.registerArtifactToolRunnerMock();
        pkgMock.registerLocationHelpersMock(tmr);
    }

    public registerArtifactToolUtilitiesMock() {
        this.tmr.registerMock('packaging-common/universal/ArtifactToolUtilities', {
            getArtifactToolFromService: function(serviceUri, accessToken, toolName) {
                return UniversalMockHelper.ArtifactToolCmd;
            },
            getPackageNameFromId: function(serviceUri: string, accessToken: string, feedId: string, packageId: string) {
                return packageId;
            }
        });
    }

    public registerArtifactToolRunnerMock() {
        var mtt = require('vsts-task-lib/mock-toolrunner');
        this.tmr.registerMock('packaging-common/universal/ArtifactToolRunner', {
            getOptions: function() {
                return {
                    cwd: process.cwd(),
                    env: Object.assign({}, process.env),
                    silent: false,
                    failOnStdErr: false,
                    ignoreReturnCode: false,
                    windowsVerbatimArguments: false
                }
            },
            runArtifactTool: function(artifactToolPath: string, command: string[], execOptions) {
                var tr = new mtt.ToolRunner(artifactToolPath)
                tr.arg(command);
                return tr.execSync(execOptions);
            }
        });
    }

    public mockUniversalCommand(command: string, feed:string, packageName: string, packageVersion: string, path: string, result: TaskLibAnswerExecResult, service?: string) {
        if (!service) {
            service = "https://example.visualstudio.com/defaultcollection";
        }
        this.answers.exec[`${UniversalMockHelper.ArtifactToolCmd} universal ${command} --feed ${feed} --service ${service} --package-name ${packageName} --package-version ${packageVersion} --path ${path} --patvar UNIVERSAL_DOWNLOAD_PAT --verbosity verbose`] = result;
    }
}
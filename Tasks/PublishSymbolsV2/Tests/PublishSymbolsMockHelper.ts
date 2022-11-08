import { TaskLibAnswers, TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as clientMock from 'azure-pipelines-tasks-packaging-common-v3/Tests/ClientToolMockHelper';

export class ClientToolMockHelper {
    private static ClientToolCmd: string = 'mock/location/symbol.exe';

    public answers: TaskLibAnswers = {
        checkPath: {},
        exec: {},
        exist: {},
        findMatch: { "pattern/to/files/*": ["c:\\temp\\file.pdb"] },
        rmRF: {},
        which: {}
    };

    constructor(private tmr: tmrm.TaskMockRunner) {
        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['AGENT_TEMPDIRECTORY'] = "c:\\agent\\_temp";
        process.env['AGENT_VERSION'] = '2.120.0';
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_SERVERTYPE'] = "hosted";
        process.env['SYMBOL_PAT_AUTH_TOKEN'] = "token";
        process.env['ARTIFACTSERVICES_SYMBOL_ACCOUNTNAME'] = 'example';
        process.env['ARTIFACTSERVICES_SYMBOL_PAT'] = 'token';
        process.env['SYSTEM_TEAMPROJECT'] = 'testpublishsymbol';
        process.env['BUILD_DEFINITIONNAME'] = 'testpublishsymbolbuild';
        process.env['BUILD_BUILDNUMBER'] = '2021.11.30';
        process.env['BUILD_BUILDID'] = '1';
        process.env['BUILD_UNIQUEID'] = '8fd4c05c-e13b-4dc1-8f0f-7e1c661db3b5';

        this.tmr.setAnswers(this.answers);

        clientMock.registerClientToolUtilitiesMock(tmr, ClientToolMockHelper.ClientToolCmd);
        clientMock.registerClientToolRunnerMock(tmr);
        this.registerOtherMock(tmr);
    }

    public mockClientToolCommand(command: string, name: string, directory: string, expirationInDays: string, fileListFileName: string, result: TaskLibAnswerExecResult, service?: string) {
        if (!service) {
            service = "https://example.artifacts.visualstudio.com";
        }
        this.answers.exec[`${ClientToolMockHelper.ClientToolCmd} ${command} --service ${service} --name ${name} --directory ${directory} --expirationInDays ${expirationInDays} --patAuthEnvVar SYMBOL_PAT_AUTH_TOKEN --fileListFileName ${fileListFileName} --tracelevel verbose --globalretrycount 2`] = result;
    }

    private registerOtherMock(tmr: tmrm.TaskMockRunner) {
        class MockStats {
            isFile = () => {
                return true;
            };
        };
        const fsAnswers = {
            writeFileSync: function (filePath, contents) {
            },
            existsSync: function (filePath, contents) {
                return true;
            },
            readFileSync: function (filePath) {
                return 'contents';
            },
            statSync: function (filePath) {
                let s: MockStats = new MockStats();
                return s;
            },
            chmodSync: function (filePath, string) {
            },
            unlinkSync: function (filePath) {
            }
        };
    
        tmr.registerMock('fs', fsAnswers);
    }
}
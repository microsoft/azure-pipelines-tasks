import { TaskLibAnswers, TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as clientMock from 'clienttool-common/Tests/ClientToolMockHelper';

export class ClientToolMockHelper {
    private static ClientToolCmd: string = 'c:\\mock\\location\\symbol.exe';

    public answers: TaskLibAnswers = {
        checkPath: {},
        exec: {},
        exist: {},
        findMatch: {},
        rmRF: {},
        which: {
            'c:\\mock\\location\\symbol.exe': ClientToolMockHelper.ClientToolCmd
        }
    };

    constructor(private tmr: tmrm.TaskMockRunner) {
        this.tmr.setInput('verbosity', "verbose");

        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['AGENT_VERSION'] = '2.120.0';
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_SERVERTYPE'] = "hosted";
        process.env['SYMBOL_PAT_AUTH_TOKEN'] = "token";

        this.tmr.setAnswers(this.answers);

        clientMock.registerClientToolUtilitiesMock(tmr, ClientToolMockHelper.ClientToolCmd);
        clientMock.registerClientToolRunnerMock(tmr);
        clientMock.registerOtherMock(tmr);
    }

    public mockClientToolCommand(command: string, name: string, directory: string, expirationInDays: string, result: TaskLibAnswerExecResult, service?: string) {
        if (!service) {
            service = "https://example.visualstudio.com/defaultcollection";
        }

        this.answers.exec[`${ClientToolMockHelper.ClientToolCmd} ${command} --name ${name} --directory ${directory} --expirationInDays ${expirationInDays} --service ${service} --patvar SYMBOL_PAT_AUTH_TOKEN --verbosity verbose`] = result;

    }
}
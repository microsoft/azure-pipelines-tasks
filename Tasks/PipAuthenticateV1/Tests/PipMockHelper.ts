import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as pkgMock from 'azure-pipelines-tasks-artifacts-common/Tests/MockHelper';

export class PipMockHelper {

    constructor(private tmr: tmrm.TaskMockRunner) {
        this.tmr.setInput('verbosity', "verbose");
        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources",
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_SERVERTYPE'] = "hosted";

        pkgMock.registerLocationHelpersMock(tmr);
    }
}
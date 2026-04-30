import * as pkgMock from 'azure-pipelines-tasks-artifacts-common/Tests/MockHelper';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

export class TwineMockHelper {

    constructor(private tmr: tmrm.TaskMockRunner) {
        this.tmr.setInput('verbosity', "verbose");
        const pypircPath = path.join(__dirname, "temp");
        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['PYPIRC_PATH'] = pypircPath + path.sep + ".pypirc";
        process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources",
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_SERVERTYPE'] = "hosted";

        pkgMock.registerLocationHelpersMock(tmr);
    }
}
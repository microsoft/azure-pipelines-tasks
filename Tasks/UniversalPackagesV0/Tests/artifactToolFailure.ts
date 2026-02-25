import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as pkgMock from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';

let taskPath = path.join(__dirname, '..', 'universalmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set up environment for hosted scenario
process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources";
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
process.env['SYSTEM_SERVERTYPE'] = "hosted";

tmr.setInput('command', 'download');
tmr.setInput('downloadDirectory', 'c:\\temp');
tmr.setInput('verbosity', 'verbose');

// Mock artifact tool utilities to fail
tmr.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities', {
    getArtifactToolFromService: async () => {
        throw new Error('Failed to acquire artifact tool');
    }
});

// Mock location helpers
pkgMock.registerLocationHelpersMock(tmr);

tmr.run();

import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import { TEST_CONSTANTS } from './testConstants';
import * as pkgMock from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';
import * as artMock from 'azure-pipelines-tasks-packaging-common/Tests/ArtifactToolMockHelper';
import * as clientMock from 'azure-pipelines-tasks-packaging-common/Tests/ClientToolMockHelper';

const taskPath = path.join(__dirname, '..', 'PreJobExecutionUniversalPackages.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Base environment
process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources";
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = JSON.stringify({
    parameters: { AccessToken: TEST_CONSTANTS.SYSTEM_TOKEN },
    scheme: 'OAuth'
});
process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = TEST_CONSTANTS.SERVICE_URL;
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = TEST_CONSTANTS.SERVICE_URL;

// Set server type from env (defaults to hosted)
const serverType = process.env['MOCK_SERVER_TYPE'] || 'hosted';
process.env['SYSTEM_SERVERTYPE'] = serverType;

// Set cached path if provided (simulates another pre-job having already resolved the path)
const cachedPath = process.env['MOCK_CACHED_ARTIFACT_TOOL_PATH'];
if (cachedPath) {
    process.env['UPACK_ARTIFACTTOOL_PATH_CACHED'] = cachedPath;
} else {
    delete process.env['UPACK_ARTIFACTTOOL_PATH_CACHED'];
}

// Set verbosity input (needed by telemetry)
tmr.setInput('command', 'download');

// Configure whether getArtifactToolFromService should fail
const shouldFailInstall = process.env['MOCK_SHOULD_FAIL_INSTALL'] === 'true';

if (shouldFailInstall) {
    tmr.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities', {
        getArtifactToolFromService: function () {
            throw new Error('Failed to download artifact tool');
        },
        getPackageNameFromId: function () {
            return '';
        }
    });
} else {
    artMock.registerArtifactToolUtilitiesMock(tmr, TEST_CONSTANTS.ARTIFACT_TOOL_PATH);
}

// Register location/client helpers mock
pkgMock.registerLocationHelpersMock(tmr);
clientMock.registerClientToolUtilitiesMock(tmr, TEST_CONSTANTS.ARTIFACT_TOOL_PATH);

// Mock telemetry
tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: function (area: string, feature: string, data: any) {
        console.log(`Telemetry emitted: ${area}.${feature}`);
    }
});

tmr.run();

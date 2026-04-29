import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as testConstants from './TestConstants';
import * as pkgMock from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';
import * as artMock from 'azure-pipelines-tasks-packaging-common/Tests/ArtifactToolMockHelper';

const taskPath = path.join(__dirname, '..', 'PreJobExecutionUniversalPackages.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Base environment
process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources";
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";

// Set server type from env (defaults to hosted)
const serverType = process.env[testConstants.TestEnvVars.serverType] || 'hosted';
process.env['SYSTEM_SERVERTYPE'] = serverType;

// Set cached path if provided (simulates another pre-job having already resolved the path)
const cachedPath = process.env[testConstants.TestEnvVars.cachedArtifactToolPath];
if (cachedPath) {
    process.env['UPACK_ARTIFACTTOOL_PATH_CACHED'] = cachedPath;
} else {
    delete process.env['UPACK_ARTIFACTTOOL_PATH_CACHED'];
}

// Set verbosity input (needed by telemetry)
tmr.setInput('verbosity', 'verbose');

// Determine artifact tool path for mocks
const artifactToolCmd = testConstants.TestData.artifactToolCmd;

// Configure whether getArtifactToolFromService should fail
const shouldFailInstall = process.env[testConstants.TestEnvVars.shouldFailInstall] === 'true';

if (shouldFailInstall) {
    // Mock artifact tool utilities to throw
    tmr.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities', {
        getArtifactToolFromService: function () {
            throw new Error('Failed to download artifact tool');
        },
        getPackageNameFromId: function () {
            return '';
        }
    });
} else {
    artMock.registerArtifactToolUtilitiesMock(tmr, artifactToolCmd);
}

// Register location helpers mock
pkgMock.registerLocationHelpersMock(tmr);

// Mock telemetry
tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: function (area: string, feature: string, data: any) {
        console.log(`Telemetry emitted: ${area}.${feature}`);
    }
});

tmr.run();

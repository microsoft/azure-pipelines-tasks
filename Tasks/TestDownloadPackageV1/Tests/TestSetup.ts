import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';
import * as testConstants from './TestConstants';
import { WebApiMock } from './helpers/webapimock';

// Get the task path
const taskPath = path.join(__dirname, '..', 'main.js');
const outputPath = path.join(__dirname, 'out', 'packageOutput');
const tempPath = path.join(__dirname, 'temp');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Read test configuration from environment variables
const packageType = process.env[testConstants.TestEnvVars.packageType] || 'nuget';
const feed = process.env[testConstants.TestEnvVars.feed] || '/feedId';
const view = process.env[testConstants.TestEnvVars.view] || 'viewId';
const definition = process.env[testConstants.TestEnvVars.definition] || testConstants.TestData.defaultPackageGuid;
const version = process.env[testConstants.TestEnvVars.version] || 'versionId';
const extract = process.env[testConstants.TestEnvVars.extract] || 'true';
const files = process.env[testConstants.TestEnvVars.files] || '';
const skipDownload = process.env[testConstants.TestEnvVars.skipDownload] || 'false';
const downloadShouldFail = process.env[testConstants.TestEnvVars.downloadShouldFail] === 'true';

// Set task inputs
tr.setInput('packageType', packageType);
tr.setInput('feed', feed);
tr.setInput('view', view);
tr.setInput('definition', definition);
tr.setInput('version', version);
tr.setInput('downloadPath', outputPath);
tr.setInput('extract', extract);
// tr.setInput('verbosity', 'verbose');
if (files) {
    tr.setInput('files', files);
}

// Set environment variables
process.env['AGENT_TEMPDIRECTORY'] = tempPath;
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = process.env[testConstants.TestEnvVars.collectionUri] || testConstants.TestData.defaultCollectionUri;
process.env['AGENT_VERSION'] = testConstants.TestData.agentVersion;
process.env['HOME'] = testConstants.TestData.homeDir;

if (skipDownload === 'true') {
    process.env['PACKAGING_SKIPDOWNLOAD'] = 'true';
}

// Determine file paths for cleanup answers based on package type
let fileExtension = '.nupkg';
switch (packageType) {
    case 'npm': fileExtension = '.tgz'; break;
    case 'cargo': fileExtension = '.crate'; break;
    case 'nuget': fileExtension = '.nupkg'; break;
}

// Build rmRF answers
const rmRFAnswers: { [key: string]: any } = {};
const singleFileName = definition === testConstants.TestData.badZipPackageGuid
    ? 'badNupkgPackageName' + fileExtension
    : 'singlePackageName' + fileExtension;

if (extract === 'true' && (packageType === 'nuget' || packageType === 'npm' || packageType === 'cargo')) {
    const zipLocation = path.join(tempPath, singleFileName);
    rmRFAnswers[zipLocation] = { success: true };
} else if (packageType === 'maven') {
    const jarLocation = path.join(outputPath, 'packageName.jar');
    const pomLocation = path.join(outputPath, 'packageName.pom');
    rmRFAnswers[jarLocation] = { success: true };
    rmRFAnswers[pomLocation] = { success: true };
} else {
    const zipLocation = path.join(outputPath, singleFileName);
    rmRFAnswers[zipLocation] = { success: true };
}

// Provide answers for task mock
const existAnswers: { [key: string]: boolean } = {
    [outputPath]: true,
};
if (extract === 'true') {
    existAnswers[tempPath] = true;
}

tr.setAnswers({
    exist: existAnswers,
    rmRF: rmRFAnswers
});

// Register connections mock
tr.registerMock('./connections', {
    getConnection: function (): Promise<any> {
        return Promise.resolve(new WebApiMock({ downloadShouldFail: downloadShouldFail }));
    }
});

// Mock universal package download
tr.registerMock('./universal', {
    downloadUniversalPackage: async function (
        downloadPath: string,
        projectId: string,
        feedId: string,
        packageId: string,
        version: string,
        filterPattern: string,
        executeWithRetries: any
    ): Promise<void> {
        console.log(`UniversalDownload:downloadPath=${downloadPath},feedId=${feedId},projectId=${projectId},packageId=${packageId},version=${version},filterPattern=${filterPattern}`);
        return;
    }
});

tr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: function (area: string, feature: string, data: any) {
        console.log(`Telemetry emitted: ${area}.${feature} with data: ${JSON.stringify(data)}`);
    }
});

tr.run();

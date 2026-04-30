import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as testConstants from './TestConstants';
import { UniversalMockHelper } from './UniversalMockHelper';

const taskPath = path.join(__dirname, '..', 'universalmain.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const umh: UniversalMockHelper = new UniversalMockHelper(tmr);

// Configure artifact tool path from env (simulates pre-job having set the task variable)
const artifactToolPath = process.env[testConstants.TestEnvVars.artifactToolPath];
if (artifactToolPath) {
    process.env['VSTS_TASKVARIABLE_UPACK_ARTIFACTTOOL_PATH'] = artifactToolPath;
} else {
    delete process.env['VSTS_TASKVARIABLE_UPACK_ARTIFACTTOOL_PATH'];
}

// Set task inputs from env vars with defaults
const command = process.env[testConstants.TestEnvVars.command] || 'download';
tmr.setInput('command', command);

if (command === 'download') {
    const downloadDir = process.env[testConstants.TestEnvVars.downloadDirectory] || testConstants.TestData.defaultDownloadDir;
    tmr.setInput('downloadDirectory', downloadDir);
    tmr.setInput('internalOrExternalDownload', process.env[testConstants.TestEnvVars.feedsToUse] || 'internal');
    tmr.setInput('feedListDownload', process.env[testConstants.TestEnvVars.feedListDownload] || testConstants.TestData.defaultFeed);
    tmr.setInput('packageListDownload', process.env[testConstants.TestEnvVars.packageListDownload] || testConstants.TestData.defaultPackage);
    tmr.setInput('versionListDownload', process.env[testConstants.TestEnvVars.versionListDownload] || testConstants.TestData.defaultVersion);
}

// Mock the ArtifactTool command execution result if exit code env var is set
const mockExitCode = process.env[testConstants.TestEnvVars.mockExitCode];
if (mockExitCode !== undefined && artifactToolPath) {
    const feed = process.env[testConstants.TestEnvVars.feedListDownload] || testConstants.TestData.defaultFeed;
    const pkg = process.env[testConstants.TestEnvVars.packageListDownload] || testConstants.TestData.defaultPackage;
    const version = process.env[testConstants.TestEnvVars.versionListDownload] || testConstants.TestData.defaultVersion;
    const downloadDir = process.env[testConstants.TestEnvVars.downloadDirectory] || testConstants.TestData.defaultDownloadDir;

    // Parse project-scoped feed
    let feedId = feed;
    let projectId: string | undefined;
    if (feed.includes('/')) {
        const parts = feed.split('/');
        projectId = parts[0];
        feedId = parts[1];
    }

    let cmdStr = `${testConstants.TestData.artifactToolCmd} universal download` +
        ` --feed ${feedId}` +
        ` --service ${testConstants.TestData.defaultServiceUri}` +
        ` --package-name ${pkg}` +
        ` --package-version ${version}` +
        ` --path ${downloadDir}` +
        ` --patvar UNIVERSAL_DOWNLOAD_PAT` +
        ` --verbosity verbose`;

    if (projectId) {
        cmdStr += ` --project ${projectId}`;
    }

    umh.answers.exec[cmdStr] = {
        code: parseInt(mockExitCode, 10),
        stdout: process.env[testConstants.TestEnvVars.mockStdout] || '',
        stderr: process.env[testConstants.TestEnvVars.mockStderr] || '',
    };
}

tmr.run();

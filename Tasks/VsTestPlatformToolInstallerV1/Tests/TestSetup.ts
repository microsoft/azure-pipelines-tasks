import  * as ma from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';
import * as tmt from 'vsts-task-lib/mock-task';
import * as testConstants from './TestConstants';
import * as constants from '../constants';
import * as path from 'path';

// Get the task path
const taskPath = path.join(__dirname, '..', 'vstestplatformtoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput(constants.packageFeedSelector, process.env[constants.packageFeedSelector]);
tr.setInput(constants.versionSelector, process.env[constants.versionSelector]);
tr.setInput(constants.testPlatformVersion, process.env[constants.testPlatformVersion]);

const expectedTestPlatformVersion = process.env[testConstants.expectedTestPlatformVersion];
const nugetToolPath = path.join(__dirname, '..', 'nuget.exe');
const downloadPath = process.env[constants.downloadPath];

// Construct commands to be mocked
const listPackagesCommand = `${nugetToolPath} list packageid:${constants.packageId} ${(process.env[constants.versionSelector] === 'latestPreRelease' ? '-PreRelease ' : '')}-Source ${constants.defaultPackageSource}`;

const downloadNugetPackageCommand = nugetToolPath + ' install ' + constants.packageId + ' -Version ' + expectedTestPlatformVersion + ' -Source ' + constants.defaultPackageSource + ' -OutputDirectory ' + downloadPath + ' -NoCache -DirectDownload';
let listPackagesCommandOutput;

if (process.env[testConstants.listPackagesOutput] !== undefined) {
    listPackagesCommandOutput = process.env[testConstants.listPackagesOutput];
} else {
    listPackagesCommandOutput = 'Microsoft.TestPlatform 15.6.0' + (process.env[constants.versionSelector] === 'latestPreRelease' ? '-preview-20171108-02' : '') + '\r\nMicrosoft.TestPlatform.Build 15.5.0\r\nMicrosoft.TestPlatform.CLI 15.5.0\r\nMicrosoft.TestPlatform.ObjectModel 15.5.0\r\nMicrosoft.TestPlatform.Portable 15.6.0-preview-20171108-02\r\nMicrosoft.TestPlatform.TestHost 15.5.0\r\nMicrosoft.TestPlatform.TranslationLayer 15.5.0';
}

// Construct the answers object
const answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {
    },
    'checkPath': {
    },
    'exec': {
    }
};

// Provide answers for task mock
answers.which[`${nugetToolPath}`] = nugetToolPath;
answers.checkPath[`${nugetToolPath}`] = true;
answers.exec[`${listPackagesCommand}`] = {
    'code': +process.env[testConstants.listPackagesReturnCode],
    'stdout': listPackagesCommandOutput,
    'stderr': ''
};
answers.exec[`${downloadNugetPackageCommand}`] = {
    'code': +process.env[testConstants.downloadPackageReturnCode],
    'stdout': '',
    'stderr': ''
};
tr.setAnswers(<any>answers);

// Mock toolrunner
tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));

// Mock task-tool-lib
const taskToolLibMock: any = {};
taskToolLibMock.findLocalTool = function(tool: string, version: string): string {

    if (process.env[testConstants.findLocalToolFirstCallReturnValue] !== testConstants.secondCacheLookup && process.env[testConstants.findLocalToolFirstCallReturnValue]) {
        tl.debug(`Cache hit for ${version}`);
        const retValue = process.env[testConstants.findLocalToolFirstCallReturnValue];
        process.env[testConstants.findLocalToolFirstCallReturnValue] = testConstants.secondCacheLookup;
        return retValue;
    }

    if (process.env[testConstants.findLocalToolFirstCallReturnValue] === testConstants.secondCacheLookup && process.env[testConstants.findLocalToolSecondCallReturnValue]) {
        tl.debug(`Cache hit for ${version}`);
        return process.env[testConstants.findLocalToolSecondCallReturnValue];
    }

    process.env[testConstants.findLocalToolFirstCallReturnValue] = testConstants.secondCacheLookup;

    tl.debug(`Cache miss for ${version}`);

    return null;
};
taskToolLibMock.isExplicitVersion = function(version: string): boolean {
    return true;
};
taskToolLibMock.cleanVersion = function(version: string): string {
    return version;
};
taskToolLibMock.cacheDir = function(toolRoot: string, packageName: string, version: string): string {
    return path.join(packageName, version);
};
tr.registerMock('vsts-task-tool-lib/tool', taskToolLibMock);

// Create mock for getVariable
const tl = require('vsts-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function(variable: string) {
    return process.env[variable];
};
tlClone.assertAgent = function(variable: string) {
    return;
};
tr.registerMock('vsts-task-lib/mock-task', tlClone);

// Start the run
tr.run();

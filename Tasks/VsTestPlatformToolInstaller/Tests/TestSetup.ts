import  * as ma from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';
import * as tmt from 'vsts-task-lib/mock-task';
import * as constants from './Constants';
import * as path from 'path';

// Get the task path
const taskPath = path.join(__dirname, '..', 'vstestplatformtoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput('versionSelector', process.env[constants.versionSelector]);
tr.setInput('testPlatformVersion', process.env[constants.testPlatformVersion]);

const expectedTestPlatformVersion = process.env[constants.expectedTestPlatformVersion];
const nugetToolPath = path.join(__dirname, '..', 'nuget.exe');
const downloadPath = process.env[constants.downloadPath];

// Construct commands to be mocked
const listPackagesCommand = nugetToolPath + ' list Microsoft.TestPlatform ' + (process.env[constants.versionSelector] === 'latestPreRelease' ? '-PreRelease ' : '') + '-Source ' + constants.packageSource;
const downloadNugetPackageCommand = nugetToolPath + ' install ' + constants.packageName + ' -Version ' + expectedTestPlatformVersion + ' -Source ' + constants.packageSource + ' -OutputDirectory ' + downloadPath + ' -NoCache -DirectDownload';
let listPackagesCommandOutput;

if (process.env[constants.listPackagesOutput] !== undefined) {
    listPackagesCommandOutput = process.env[constants.listPackagesOutput];
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
    'code': +process.env[constants.listPackagesReturnCode],
    'stdout': listPackagesCommandOutput,
    'stderr': ''
};
answers.exec[`${downloadNugetPackageCommand}`] = {
    'code': +process.env[constants.downloadPackageReturnCode],
    'stdout': '',
    'stderr': ''
};
tr.setAnswers(<any>answers);

// Mock toolrunner
tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));

// Mock task-tool-lib
const taskToolLibMock: any = {};
taskToolLibMock.findLocalTool = function(tool: string, version: string): string {

    if (process.env[constants.findLocalToolFirstCallReturnValue] !== constants.secondCacheLookup && process.env[constants.findLocalToolFirstCallReturnValue]) {
        tl.debug(`Cache hit for ${version}`);
        const retValue = process.env[constants.findLocalToolFirstCallReturnValue];
        process.env[constants.findLocalToolFirstCallReturnValue] = constants.secondCacheLookup;
        return retValue;
    }

    if (process.env[constants.findLocalToolFirstCallReturnValue] === constants.secondCacheLookup && process.env[constants.findLocalToolSecondCallReturnValue]) {
        tl.debug(`Cache hit for ${version}`);
        return process.env[constants.findLocalToolSecondCallReturnValue];
    }

    process.env[constants.findLocalToolFirstCallReturnValue] = constants.secondCacheLookup;

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
tr.registerMock('vsts-task-lib/mock-task', tlClone);

// Start the run
tr.run();

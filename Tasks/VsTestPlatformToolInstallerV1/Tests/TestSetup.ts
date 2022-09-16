import  * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as testConstants from './TestConstants';
import * as testHelpers from './TestHelpers';
import * as constants from '../constants';
import * as path from 'path';

// Get the task path
const taskPath = path.join(__dirname, '..', 'vstestplatformtoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
if (!testHelpers.isNullEmptyOrUndefined(process.env[constants.packageFeedSelector])) {
    tr.setInput(constants.packageFeedSelector, process.env[constants.packageFeedSelector]);
}

if (!testHelpers.isNullEmptyOrUndefined(process.env[constants.versionSelector])) {
    tr.setInput(constants.versionSelector, process.env[constants.versionSelector]);
}

if (!testHelpers.isNullEmptyOrUndefined(process.env[constants.testPlatformVersion])) {
    tr.setInput(constants.testPlatformVersion, process.env[constants.testPlatformVersion]);
}

if (!testHelpers.isNullEmptyOrUndefined(process.env[constants.customFeed])) {
    tr.setInput(constants.customFeed, process.env[constants.customFeed]);
}

if (!testHelpers.isNullEmptyOrUndefined(process.env[constants.username])) {
    tr.setInput(constants.username, process.env[constants.username]);
}

if (!testHelpers.isNullEmptyOrUndefined(process.env[constants.password])) {
    tr.setInput(constants.password, process.env[constants.password]);
}

if (!testHelpers.isNullEmptyOrUndefined(process.env[constants.netShare])) {
    tr.setInput(constants.netShare, process.env[constants.netShare]);
}

const expectedTestPlatformVersion = process.env[testConstants.expectedTestPlatformVersion];
const nugetToolPath = path.join(__dirname, '..', 'nuget.exe');
const downloadPath = process.env[constants.downloadPath];

// Construct commands to be mocked
let listPackagesCommand = '';
listPackagesCommand = testHelpers.addArg(listPackagesCommand, nugetToolPath);
listPackagesCommand = testHelpers.addArg(listPackagesCommand, constants.list);
if (process.env[constants.packageFeedSelector] === constants.nugetOrg) {
    listPackagesCommand = testHelpers.addArg(listPackagesCommand, `packageid:${constants.packageId}`);
} else {
    listPackagesCommand = testHelpers.addArg(listPackagesCommand, constants.packageId);
}
if (process.env[constants.versionSelector] === testConstants.latestPreRelease) {
    listPackagesCommand = testHelpers.addArg(listPackagesCommand, constants.preRelease);
}
listPackagesCommand = testHelpers.addArg(listPackagesCommand, constants.noninteractive);
listPackagesCommand = testHelpers.addArg(listPackagesCommand, constants.source);
listPackagesCommand = testHelpers.addArg(listPackagesCommand, process.env[testConstants.packageSource]);
if (!testHelpers.isNullEmptyOrUndefined(process.env[testConstants.configFile])) {
    listPackagesCommand = testHelpers.addArg(listPackagesCommand, constants.configFile);
    listPackagesCommand = testHelpers.addArg(listPackagesCommand, process.env[testConstants.configFile]);
}

console.log(`List package command: ${listPackagesCommand}\n`);

let downloadNugetPackageCommand = '';
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, nugetToolPath);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, constants.install);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, constants.packageId);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, constants.version);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, expectedTestPlatformVersion);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, constants.source);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, process.env[testConstants.packageSource]);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, constants.outputDirectory);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, downloadPath);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, constants.noCache);
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, constants.directDownload);
if (!testHelpers.isNullEmptyOrUndefined(process.env[testConstants.configFile])) {
    downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, constants.configFile);
    downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, process.env[testConstants.configFile]);
}
downloadNugetPackageCommand = testHelpers.addArg(downloadNugetPackageCommand, constants.noninteractive);

console.log(`Download nuget package command: ${downloadNugetPackageCommand}\n`);

if (testHelpers.isNullEmptyOrUndefined(process.env[constants.username])) {
    process.env[constants.username] = constants.defaultUsername;
}

let writeNugetConfigCommand = '';
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, nugetToolPath);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.sources);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.add);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.noninteractive);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.name);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, process.env[testConstants.feedId]);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.source);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, process.env[constants.customFeed]);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.validAuthenticationTypes);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.basic);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.usernameParam);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, process.env[constants.username]);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.passwordParam);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, process.env[constants.password]);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, constants.configFile);
writeNugetConfigCommand = testHelpers.addArg(writeNugetConfigCommand, `${process.env[constants.agentTempDirectory]}\\${process.env[testConstants.feedId]}.config`);

console.log(`Write nuget config command: ${writeNugetConfigCommand}\n`);

let listPackagesCommandOutput;
if (process.env[testConstants.listPackagesOutput] !== undefined) {
    listPackagesCommandOutput = process.env[testConstants.listPackagesOutput];
} else {
    listPackagesCommandOutput = 'Microsoft.TestPlatform 15.6.0'
         + (process.env[constants.versionSelector] === 'latestPreRelease' ? '-preview-20171108-02' : '')
         + '\r\nMicrosoft.TestPlatform.Build 15.5.0\r\nMicrosoft.TestPlatform.CLI 15.5.0\r\nMicrosoft.TestPlatform.ObjectModel 15.5.0\r\nMicrosoft.TestPlatform.Portable 15.6.0-preview-20171108-02\r\nMicrosoft.TestPlatform.TestHost 15.5.0\r\nMicrosoft.TestPlatform.TranslationLayer 15.5.0';
}

// Construct the answers object
const answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {
    },
    'checkPath': {
    },
    'exec': {
    },
    'exist': {
    },
    'stats' : {
    }
};

// Provide answers for task mock
if (!testHelpers.isNullEmptyOrUndefined(process.env[constants.netShare])) {
    answers.exist[`${process.env[constants.netShare]}`] = true;
    answers.stats[`${process.env[constants.netShare]}`] = { 'isFile': true };
}
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
answers.exec[`${writeNugetConfigCommand}`] = {
    'code': +process.env[testConstants.writeNugetConfigReturnCode],
    'stdout': '',
    'stderr': ''
};
tr.setAnswers(<any>answers);

// Mock toolrunner
tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

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
tr.registerMock('azure-pipelines-tool-lib/tool', taskToolLibMock);

// Create mock for getVariable
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function(variable: string) {
    return process.env[variable];
};
// Create a mock for asser agent
tlClone.assertAgent = function(variable: string) {
    return;
};
// Register the tl mock
tr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

const uuid = require('uuid');
// Create a mock for the uuid module
const uuidClone = Object.assign({}, uuid);
uuidClone.v1 = function() {
    return process.env[testConstants.feedId];
};

tr.registerMock('uuid', uuidClone);

const fs = require('fs');
// Create a mock for fs operations
const fsClone = Object.assign({}, fs);
fsClone.writeFileSync = function(filePath: string, contents: string, options?: string) {
    console.log(contents);
    return;
};
// mock unlink
fsClone.unlinkSync = function(filePath: string) {
    console.log(`Deleted file ${filePath}`);
    return;
};

tr.registerMock('fs', fsClone);

// Start the run
tr.run();
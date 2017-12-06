import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import tmt = require('vsts-task-lib/mock-task');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'vstestplatformtoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const packageName = 'Microsoft.TestPlatform';
const packageSource = 'https://api.nuget.org/v3/index.json';

tr.setInput('versionSelector', process.env['versionSelector']);
tr.setInput('testPlatformVersion', process.env['testPlatformVersion']);

console.log("Inputs have been set");

//process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  DefaultWorkingDirectory;

process.env['Agent.TempDirectory'] = 'temppppppppppp';

const nugetToolPath = path.join(__dirname, '..', 'nuget.exe');

const testPlatformVersion = '15.6.0-preview-20171108-02';
let downloadPath = process.env['Agent.TempDirectory'];
downloadPath = path.join(downloadPath, 'VsTest');

const listPreReleaseCommand = nugetToolPath + ' list Microsoft.TestPlatform -PreRelease -Source https://api.nuget.org/v3/index.json';

const downloadNugetPackageCommand = nugetToolPath + ' install ' + packageName + ' -Version ' + testPlatformVersion + ' -Source ' + packageSource + ' -OutputDirectory ' + downloadPath + ' -NoCache -DirectDownload';

console.log(downloadNugetPackageCommand);
console.log('D:\\OtherRepos\\vsts-tasks4\\_build\\Tasks\\VisualStudioTestPlatformInstaller\\nuget.exe install Microsoft.TestPlatform -Version 15.6.0-preview-20171108-02 -Source https://api.nuget.org/v3/index.json -OutputDirectory temppppppppppp\\VsTest -NoCache -DirectDownload')

const listPreReleaseCommandOutput = 'Microsoft.TestPlatform 15.6.0-preview-20171108-02\r\nMicrosoft.TestPlatform.Build 15.5.0\r\nMicrosoft.TestPlatform.CLI 15.5.0\r\nMicrosoft.TestPlatform.ObjectModel 15.5.0\r\nMicrosoft.TestPlatform.Portable 15.6.0-preview-20171108-02\r\nMicrosoft.TestPlatform.TestHost 15.5.0\r\nMicrosoft.TestPlatform.TranslationLayer 15.5.0';

// provide answers for task mock
const answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {
    },
    'checkPath': {
    },
    'exec': {
    }
};

answers.which[`${nugetToolPath}`] = nugetToolPath;
answers.checkPath[`${nugetToolPath}`] = true;
answers.exec[`${listPreReleaseCommand}`] = {
    'code': 0,
    'stdout': listPreReleaseCommandOutput,
    'stderr': ''
};

answers.exec[`${downloadNugetPackageCommand}`] = {
    'code': 0,
    'stdout': '',
    'stderr': ''
};

tr.setAnswers(<any>answers);
tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));

const taskToolLibMock: any = {};

taskToolLibMock.findLocalTool = function(tool: string, version: string): string {
    // if (tool && version) {
    //     return tool + version;
    // }
    return null;
};

taskToolLibMock.isExplicitVersion = function(version: string): boolean {
    return true;
};

taskToolLibMock.cleanVersion = function(version: string): string {
    return version;
};

taskToolLibMock.cacheDir = function(toolRoot: string, packageName: string, version: string): string {
    return packageName + toolRoot + version;
};

tr.registerMock('vsts-task-tool-lib/tool', taskToolLibMock);

// Create mock for getVariable
const tl = require('vsts-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

tlClone.getVariable = function(variable: string) {
    return process.env[variable];
};

tr.registerMock('vsts-task-lib/mock-task', tlClone);

// // provide answers for task mock
// let a = {
//     "which": {
//         "docker": "docker"
//     },
//      "checkPath": {
//         "docker": true,
//         [ImageNamesPath]: true
//     },
//     "exist": {
//         "docker": true,
//         [ImageNamesPath]: true
//     },
//     "exec": {
//        "docker push test/test:2" : {
//            "code": 0,
//             "stdout": "successfully pushed test/test:2 image"
//        },
//        "docker run --rm test/test:2" : {
//            "code": 0,
//             "stdout": "successfully ran test/test:2 image"
//        },
//        "docker pull test/test:2": {
//            "code": 0,
//            "stdout": "successfully pulled test/test:2 image"
//        }
//     }
// };

// // Add extra answer definitions that need to be dynamically generated
// a.exist[DockerFilePath] = true;

// a.exec[`docker build -f ${DockerFilePath} -t test/test:2`] = {
//     "code": 0,
//     "stdout": "successfully build test/test:2 image"
// };
// a.exec[`docker build -f ${DockerFilePath} -t test/test:2 -t test/test`] = {
//     "code": 0,
//     "stdout": "successfully build test/test image with latest tag"
// };
// a.exec[`docker build -f ${DockerFilePath} -t ajgtestacr1.azurecr.io/test/test:2`] = {
//     "code": 0,
//     "stdout": "successfully build ajgtestacr1.azurecr.io/test/test image with latest tag"
// };
// a.exec[`docker build -f ${DockerFilePath} -t ${shared.ImageNamesFileImageName}`] = {
//     "code": 0
// };
// a.exec[`docker tag test/test:2 ajgtestacr1.azurecr.io/test/test:2`] = {
//     "code": 0
// };
// a.exec[`docker tag ${shared.ImageNamesFileImageName} ajgtestacr1.azurecr.io/${shared.ImageNamesFileImageName}:latest`] = {
//     "code": 0
// };
// a.exec[`docker run --rm ${shared.ImageNamesFileImageName}`] = {
//     "code": 0
// };
// a.exec[`docker push ${shared.ImageNamesFileImageName}:latest`] = {
//     "code": 0
// };
// a.exec[`docker build -f ${DockerFilePath} -t test/test:2 -t test/test:6`] = {
//     "code": 0,
//     "stdout": "successfully build test/test:2 and test/test:6 image"
// };

// Create mock for fs module
// let fs = require('fs');
// let fsClone = Object.assign({}, fs);
// fsClone.readFileSync = function(filePath, options) {
//     switch (filePath) {
//         case ImageNamesPath:
//             return shared.ImageNamesFileImageName;
//         default:
//             return fs.readFileSync(filePath, options);
//     }
// };
// tr.registerMock('fs', fsClone);

tr.run();
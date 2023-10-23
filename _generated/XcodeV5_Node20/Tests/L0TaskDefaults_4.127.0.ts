
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

// Xcode task defaults used for version 4.127.0.
tr.setInput('actions', 'build');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/project.xcworkspace');
tr.setInput('scheme', '');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('packageApp', 'false');
tr.setInput('archivePath', '');
tr.setInput('exportPath', 'output/$(SDK)/$(Configuration)');
tr.setInput('exportOptions', 'auto');
tr.setInput('exportMethod', 'development');
tr.setInput('exportTeamId', '');
tr.setInput('exportOptionsPlist', '');
tr.setInput('exportArgs', '');
tr.setInput('signingOption', 'nosign');
tr.setInput('signingIdentity', '');
tr.setInput('provisioningProfileUuid', '');
tr.setInput('teamId', '');
tr.setInput('destinationPlatformOption', 'default');
tr.setInput('destinationPlatform', '');
tr.setInput('destinationTypeOption', 'simulators');
tr.setInput('destinationSimulators', 'iPhone 7');
tr.setInput('destinationDevices', '');
tr.setInput('args', '');
tr.setInput('cwd', '');
tr.setInput('outputPattern', '');
tr.setInput('useXcpretty', 'false');
tr.setInput('publishJUnitResults', 'false');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xcodebuild": "/home/bin/xcodebuild"
    },
    "checkPath": {
        "/home/bin/xcodebuild": true
    },
    "filePathSupplied": {
        "archivePath": false
    },
    "getVariable": {
        "HOME": "/users/test"
    },
    "stats": {
        "/user/build": {
            "isFile": false
        }
    },
    "findMatch": {
        "**/*.xcodeproj/project.xcworkspace": [
            "/user/build/fun.xcodeproj/project.xcworkspace"
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -list": {
            "code": 0,
            "stdout": 'Information about workspace "Fun":\n    Schemes:\n        funScheme\n\n'
        },
        "/home/bin/xcodebuild -version": {
            "code": 0,
            "stdout": "Xcode 7.3.1"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme funScheme build CODE_SIGNING_ALLOWED=NO": {
            "code": 0,
            "stdout": "xcodebuild output here"
        }
    }
};
tr.setAnswers(a);

tr.run();


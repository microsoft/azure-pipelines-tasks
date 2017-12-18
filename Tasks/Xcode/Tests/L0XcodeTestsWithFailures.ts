
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

// Xcode task run tests
tr.setInput('actions', 'test');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/project.xcworkspace');
tr.setInput('scheme', 'testScheme');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('packageApp', 'false');
tr.setInput('signingOption', 'default');
tr.setInput('destinationPlatformOption', 'default');
tr.setInput('destinationPlatform', '');
tr.setInput('destinationTypeOption', 'simulators');
tr.setInput('destinationSimulators', 'iPhone 7');
tr.setInput('destinationDevices', '');
tr.setInput('useXcpretty', 'true');
tr.setInput('publishJUnitResults', 'true');
tr.setInput('cwd', '/home/build');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xcodebuild": "/home/bin/xcodebuild",
        "xcpretty": "/home/bin/xcpretty"
    },
    "checkPath": {
        "/home/bin/xcodebuild": true,
        "/home/bin/xcpretty": true
    },
    "filePathSupplied": {
        "archivePath": false
    },
    "getVariable": {
        "HOME": "/users/test"
    },
    "exist": {
        "/user/build/_XcodeTaskExport_testScheme": false
    },
    "stats": {
        "/user/build": {
            "isFile": false
        }
    },
    "findMatch": {
        "**/*.xcodeproj/project.xcworkspace": [
            "/user/build/fun.xcodeproj/project.xcworkspace"
        ],
        "/home/build/**/build/reports/junit.xml": [
            "/home/build/testbuild1/build/reports/junit.xml"
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -version": {
            "code": 0,
            "stdout": "Xcode 9.3.1"
        },
        "/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme test | /home/bin/xcpretty -r junit --no-color": {
            "code": 1,
            "stdout": "test1 failed"
        }
    }
};
tr.setAnswers(a);

tr.run();


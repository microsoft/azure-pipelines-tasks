
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

tr.setInput('actions', 'build');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'testScheme');
tr.setInput('xcodeVersion', 'default');
tr.setInput('packageApp', 'true');
tr.setInput('signingOption', 'auto');
tr.setInput('args', '');
tr.setInput('cwd', '/user/build');
tr.setInput('outputPattern', 'output/$(SDK)/$(Configuration)');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('args', '-allowProvisioningUpdates');
tr.setInput('packageTool', 'xcodebuild');
tr.setInput('xctoolReporter', '');
tr.setInput('publishJUnitResults', 'false');
tr.setInput('archivePath', '/user/build');
tr.setInput('exportPath', '/user/build');
tr.setInput('exportOptions', 'specify');
tr.setInput('exportMethod', 'development');
tr.setInput('exportArgs', '-allowProvisioningUpdates');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xcodebuild": "/home/bin/xcodebuild",
        "security": "/usr/bin/security",
        "/usr/libexec/PlistBuddy": "/usr/libexec/PlistBuddy",
        "rm": "/bin/rm",
        "cp": "/bin/cp"
    },
    "checkPath": {
        "/home/bin/xcodebuild": true,
        "/usr/bin/security": true,
        "/usr/libexec/PlistBuddy": true,
        "/bin/rm": true,
        "/bin/cp": true
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
        "**/*.xcodeproj/*.xcworkspace": [
            "/user/build/fun.xcodeproj/project.xcworkspace"
        ],
        "**/*.app": [
            "/user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.app"
        ],
        "**/*.xcarchive": [
            "/user/build/testScheme.xcarchive"
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -version": {
            "code": 0,
            "stdout": "Xcode 9.0"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build -allowProvisioningUpdates CODE_SIGN_STYLE=Automatic": {
            "code": 0,
            "stdout": "xcodebuild output here"
        },
        "/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates": {
            "code": 0,
            "stdout": "xcodebuild archive output here"
        },
        "/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive -exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist -allowProvisioningUpdates": {
            "code": 0,
            "stdout": "xcodebuild export output here"
        },
        "/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist": {
            "code": 0,
            "stdout": "plist initialized output here"
        },
        "/usr/libexec/PlistBuddy -c Add method string development _XcodeTaskExportOptions.plist": {
            "code": 0,
            "stdout": "plist add output here"
        }
    }
};
tr.setAnswers(a);

tr.run();


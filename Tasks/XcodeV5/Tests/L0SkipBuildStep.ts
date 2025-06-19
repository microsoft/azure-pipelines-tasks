import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME'] = '/users/test';
process.env['AGENT_VERSION'] = '2.122.0';
process.env['BUILD_SOURCESDIRECTORY'] = '/user/build';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = '/user/build';

// Set task inputs
tr.setInput('actions', 'build');
tr.setInput('configuration', 'Release');
tr.setInput('sdk', 'iphoneos');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'MyScheme');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('packageApp', 'true');
tr.setInput('skipBuildStep', 'true');  // This is the key difference
tr.setInput('signingOption', 'nosign');
tr.setInput('args', '');
tr.setInput('cwd', '/user/build');
tr.setInput('destinationPlatformOption', 'default');
tr.setInput('outputPattern', '');
tr.setInput('useXcpretty', 'false');
tr.setInput('publishJUnitResults', 'false');
tr.setInput('archivePath', '/user/build');
tr.setInput('exportPath', '/user/build');
tr.setInput('exportOptions', 'auto');

// Provide mock answers for task execution
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xcodebuild": "/home/bin/xcodebuild",
        "/usr/libexec/PlistBuddy": "/usr/libexec/PlistBuddy"
    },
    "checkPath": {
        "/home/bin/xcodebuild": true,
        "/usr/libexec/PlistBuddy": true
    },
    "filePathSupplied": {
        "xcWorkspacePath": true,
        "archivePath": false
    },
    "getVariable": {
        "build.sourcesDirectory": "/user/build",
        "HOME": "/users/test"
    },
    "stats": {
        "/user/build": {
            "isFile": false
        }
    },
    "findMatch": {
        "**/*.xcodeproj/*.xcworkspace": [
            "/user/build/MyApp.xcodeproj/project.xcworkspace"
        ],
        "**/*.xcarchive": [
            "/user/build/MyScheme.xcarchive"
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -version": {
            "code": 0,
            "stdout": "Xcode 12.4\nBuild version 12D4e"
        },
        "/home/bin/xcodebuild -workspace /user/build/MyApp.xcodeproj/project.xcworkspace -scheme MyScheme archive -sdk iphoneos -configuration Release -archivePath /user/build/MyScheme CODE_SIGNING_ALLOWED=NO": {
            "code": 0,
            "stdout": "archive step completed successfully"
        },
        "/home/bin/xcodebuild -exportArchive -archivePath /user/build/MyScheme.xcarchive -exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist": {
            "code": 0,
            "stdout": "exportArchive completed successfully"
        },
        "/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist": {
            "code": 0,
            "stdout": "plist cleared"
        }
    }
};

tr.setAnswers(a);

// Run the task
tr.run();
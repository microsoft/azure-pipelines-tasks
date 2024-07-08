
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

tr.registerMock('fs', {
    ...fs,
    createReadStream: function (path) {
        if (path === '/user/build/fun.xcodeproj/project.pbxproj') {
            return undefined;
        }
        throw "createReadStream mocking: path not expected";
    },
    statSync: fs.statSync,
    readFileSync: fs.readFileSync,
    writeFileSync: function (filePath, contents) {
    },
});

tr.registerMock('readline', {
    createInterface: function () {
        return {
            on: function(event, cb) {
                if (event === 'line') {
                    cb("Foo");
                    cb("                                    ProvisioningStyle = Automatic;"); // First line wins. This should be ignored.
                    cb("Bar");
                    cb("Baz");
                }
            }
        };
    }
});

tr.setInput('actions', 'build');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'testScheme');
tr.setInput('xcodeVersion', 'default');
tr.setInput('packageApp', 'true');
tr.setInput('signingOption', 'default');
tr.setInput('signingIdentity', '');
tr.setInput('provisioningProfileUuid', '');
tr.setInput('args', '');
tr.setInput('cwd', '/user/build');
tr.setInput('outputPattern', 'output/$(SDK)/$(Configuration)');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('useXctool', 'false');
tr.setInput('packageTool', 'xcodebuild');
tr.setInput('xctoolReporter', '');
tr.setInput('publishJUnitResults', 'false');
tr.setInput('archivePath', '/user/build');
tr.setInput('exportPath', '/user/build');
tr.setInput('exportOptions', 'auto');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xcodebuild": "/home/bin/xcodebuild",
        "security": "/usr/bin/security",
        "/usr/libexec/PlistBuddy": "/usr/libexec/PlistBuddy",
        "rm": "/bin/rm"
    },
    "checkPath": {
        "/home/bin/xcodebuild": true,
        "/usr/bin/security": true,
        "/usr/libexec/PlistBuddy": true,
        "/bin/rm": true,
    },
    "filePathSupplied": {
        "archivePath": false
    },
    "getVariable": {
        "build.sourcesDirectory": "/user/build",
        "HOME": "/users/test"
    },
    "stats": {
        "/user/build": {
            "isFile": false
        },
        "/user/build/fun.xcodeproj/project.pbxproj": {
            "isFile": true
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
        ],
        "**/embedded.mobileprovision": [
            "/user/build/testScheme.xcarchive/Products/testScheme.app/embedded.mobileprovision"
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -version": {
            "code": 0,
            "stdout": "Xcode 9.0"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build": {
            "code": 0,
            "stdout": "xcodebuild output here"
        },
        "/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme": {
            "code": 0,
            "stdout": "xcodebuild archive output here"
        },
        "/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive -exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist": {
            "code": 0,
            "stdout": "xcodebuild export output here"
        },
        "/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist": {
            "code": 0,
            "stdout": "plist initialized output here"
        },
        "/usr/libexec/PlistBuddy -c Add method string app-store _XcodeTaskExportOptions.plist": {
            "code": 0,
            "stdout": "plist add output here"
        },
        "/usr/bin/security cms -D -i /user/build/testScheme.xcarchive/Products/testScheme.app/embedded.mobileprovision": {
            "code": 0,
            "stdout": "prov profile details here"
        },
        "/usr/libexec/PlistBuddy -c Print ProvisionsAllDevices _xcodetasktmp.plist": {
            "code": 1,
            "stdout": "ProvisionsAllDevices not found"
        },
        "/usr/libexec/PlistBuddy -c Print Entitlements:get-task-allow _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "false"
        },
        "/usr/libexec/PlistBuddy -c Print ProvisionedDevices _xcodetasktmp.plist": {
            "code": 1,
            "stdout": "ProvisionedDevices not found"
        },
        "/bin/rm -f _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "delete output here"
        },
        "/usr/libexec/PlistBuddy -c Print Entitlements:com.apple.developer.icloud-container-environment _xcodetasktmp.plist": {
            "code": 1,
            "stdout": ":com.apple.developer.icloud-container-environment, Does Not Exist"
        }
    }
};
tr.setAnswers(a);

tr.run();


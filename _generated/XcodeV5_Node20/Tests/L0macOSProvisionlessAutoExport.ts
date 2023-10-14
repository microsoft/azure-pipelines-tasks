
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
                }
            }
        };
    }
});

tr.setInput('actions', 'build');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/project.xcworkspace');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('packageApp', 'true');
tr.setInput('archivePath', '/user/build');
tr.setInput('exportPath', '/user/build');
tr.setInput('exportOptions', 'auto');
tr.setInput('exportOptionsPlist', '');
tr.setInput('exportArgs', '');
tr.setInput('signingOption', 'default');
tr.setInput('cwd', '/user/build');
tr.setInput('destinationPlatformOption', 'default');
tr.setInput('outputPattern', '');
tr.setInput('useXcpretty', 'false');
tr.setInput('publishJUnitResults', 'false');

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
        "**/*.xcodeproj/project.xcworkspace": [
            "/user/build/fun.xcodeproj/project.xcworkspace"
        ],
        "**/*.app": [
            "/user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.app"
        ],
        "**/*.xcarchive": [
            "/user/build/testScheme.xcarchive"
        ],
        "**/embedded.mobileprovision": [],
        "**/embedded.provisionprofile": [
            // An automatic signed macOS app might not have an embedded provisioning profile
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -list": {
            "code": 0,
            "stdout": 'Information about workspace "Fun":\n    Schemes:\n        funScheme\n\n'
        },
        "/home/bin/xcodebuild -version": {
            "code": 0,
            "stdout": "Xcode 9.2"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme funScheme build": {
            "code": 0,
            "stdout": "xcodebuild output here"
        },
        "/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme funScheme archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/funScheme": {
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
        "/bin/rm -f _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "delete output here"
        }
    }
};
tr.setAnswers(a);

tr.run();


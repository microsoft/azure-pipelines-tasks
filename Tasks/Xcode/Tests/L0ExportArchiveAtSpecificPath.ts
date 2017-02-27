
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('actions', 'build');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'testScheme');
tr.setInput('packageApp', 'true');
tr.setInput('signMethod', 'file');
tr.setInput('p12', '/user/build');
tr.setInput('p12pwd', '');
tr.setInput('provProfile', '/user/build');
tr.setInput('removeProfile', 'false');
tr.setInput('unlockDefaultKeychain', 'false');
tr.setInput('defaultKeychainPassword', '');
tr.setInput('iosSigningIdentity', '');
tr.setInput('provProfileUuid', '');
tr.setInput('args', '');
tr.setInput('cwd', '/user/build');
tr.setInput('outputPattern', 'output/$(SDK)/$(Configuration)');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('useXctool', 'false');
tr.setInput('xctoolReporter', '');
tr.setInput('publishJUnitResults', 'false');
tr.setInput('archivePath', '/user/output/myarchive.xcarchive');
tr.setInput('exportPath', '/user/output/myipa.ipa');
tr.setInput('exportOptions', 'specify');
tr.setInput('exportMethod', 'development');

// provide answers for task mock
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
        "archivePath": false
    },
    "getVariable": {
        "build.sourcesDirectory": "/user/build",
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
    "glob": {
        "**/*.xcodeproj/*.xcworkspace": [
            "/user/build/fun.xcodeproj/project.xcworkspace"
        ],
        "/user/build/output/$(SDK)/$(Configuration)/build.sym/**/*.app": [
            "/user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.app"
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -version": {
            "code": 0,
            "stdout": "Xcode 7.3.1"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch": {
            "code": 0,
            "stdout": "xcodebuild output here"
        },
        "/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/output/myarchive.xcarchive": {
            "code": 0,
            "stdout": "xcodebuild archive output here"
        },
        "/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive -exportPath /user/output/myipa.ipa/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist": {
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


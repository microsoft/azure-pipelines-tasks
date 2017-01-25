
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME']='/users/test'; //replace with mock of setVariable when task-lib has the support
process.env['USEXCRUN']='false';

tr.setInput('actions', 'build');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'testScheme');
tr.setInput('packageApp', 'true');
tr.setInput('signMethod', 'file');
tr.setInput('p12', '/user/build/cert.p12');
tr.setInput('p12pwd', 'p12password');
tr.setInput('provProfile', '/user/build/testuuid.mobileprovision');
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
tr.setInput('archivePath', '/user/build');
tr.setInput('exportPath', '/user/build');
tr.setInput('exportOptions', 'specify');
tr.setInput('exportMethod', 'development');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xcodebuild": "/home/bin/xcodebuild",
        "security": "/usr/bin/security",
        "openssl": "/usr/bin/openssl",
        "/usr/libexec/PlistBuddy": "/usr/libexec/PlistBuddy",
        "rm": "/bin/rm",
        "cp": "/bin/cp"
    },
    "checkPath" : {
        "/home/bin/xcodebuild": true,
        "/usr/bin/security": true,
        "/usr/bin/openssl": true,
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
    "exist": {
        "/user/build/cert.p12": true,
        "/user/build/testuuid.mobileprovision": true,
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
        ],
        "/user/build/**/*.xcarchive": [
            "/user/build/testScheme.xcarchive"
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -version": {
            "code": 0,
            "stdout": "Xcode 7.3.1"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch OTHER_CODE_SIGN_FLAGS=--keychain=/user/build/_xcodetasktmp.keychain CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE=testuuid": {
            "code": 0,
            "stdout": "xcodebuild output here"
        },
        "/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme OTHER_CODE_SIGN_FLAGS=--keychain=/user/build/_xcodetasktmp.keychain CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE=testuuid" : {
            "code": 0,
            "stdout": "xcodebuild archive output here"
        },
        "/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive -exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist": {
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
        },
        "/usr/bin/security create-keychain -p _xcodetask_TmpKeychain_Pwd#1 /user/build/_xcodetasktmp.keychain" : {
            "code": 0,
            "stdout": "temporary keychain created"
        },
        "/usr/bin/security set-keychain-settings -lut 7200 /user/build/_xcodetasktmp.keychain": {
            "code": 0,
            "stdout": "set-keychain-settings on temporary keychain output"
        },
        "/usr/bin/security unlock-keychain -p _xcodetask_TmpKeychain_Pwd#1 /user/build/_xcodetasktmp.keychain": {
            "code": 0,
            "stdout": "temporary keychain unlocked"
        },
        "/usr/bin/security import /user/build/cert.p12 -P p12password -A -t cert -f pkcs12 -k /user/build/_xcodetasktmp.keychain": {
            "code": 0,
            "stdout": "p12 imported into temporary keychain"
        },
        "/usr/bin/security find-identity -v -p codesigning /user/build/_xcodetasktmp.keychain" : {
            "code": 0,
            "stdout": "1) 5229BFC905F473E52FAD51208174528106966930 \"iPhone Developer: XcodeTask Tester (HE432Y3E2Q)\"\n 1 valid identities found"
        },
        "/usr/bin/openssl smime -inform der -verify -noverify -in /user/build/testuuid.mobileprovision": {
            "code": 0,
            "stdout": "prov profile details here"
        },
        "/usr/libexec/PlistBuddy -c Print UUID _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "testuuid"
        },
        "/bin/rm -f _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "delete output here"
        },
        "/usr/bin/security list-keychain -d user" : {
            "code": 0,
            "stdout":  "/User/test/Library/Keychains/login.keychain \n /user/build/_xcodetasktmp.keychain"
        },
        "/usr/bin/security list-keychain -d user -s /user/build/_xcodetasktmp.keychain /User/test/Library/Keychains/login.keychain /user/build/_xcodetasktmp.keychain" : {
            "code": 0,
            "stdout": "list-keychain output here"
        },
        "/bin/cp -f /user/build/testuuid.mobileprovision /users/test/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision": {
            "code": 0,
            "stdout": "provisioning profile copied"
        }
    }
};
tr.setAnswers(a);

tr.run();


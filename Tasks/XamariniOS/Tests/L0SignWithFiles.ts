
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'XamariniOS.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME']='/user/home'; //replace with mock of setVariable when task-lib has the support

tr.setInput('solution', 'src/project.sln'); //path
tr.setInput('configuration', 'Release');
tr.setInput('args', '');
tr.setInput('packageApp', ''); //boolean
tr.setInput('forSimulator', ''); //boolean
tr.setInput('signMethod', 'file');
tr.setInput('unlockDefaultKeychain', ''); //boolean
tr.setInput('defaultKeychainPassword', '');
tr.setInput('p12', '/user/build/cert.p12'); //path
tr.setInput('p12pwd', 'p12password');
tr.setInput('iosSigningIdentity', '');
tr.setInput('provProfileUuid', '');
tr.setInput('provProfile', '/user/build/testuuid.mobileprovision'); //path
tr.setInput('removeProfile', ''); //boolean
tr.setInput('cwd', '/user/build');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": {
        "HOME": "/user/home"
    },
    "which": {
        "xbuild": "/home/bin/xbuild",
        "nuget": "/home/bin/nuget",
        "security": "/usr/bin/security",
        "/usr/libexec/PlistBuddy": "/usr/libexec/PlistBuddy",
        "rm": "/bin/rm",
        "cp": "/bin/cp"
    },
    "exec": {
        "/home/bin/nuget restore src/project.sln": {
            "code": 0,
            "stdout": "nuget restore"
        },
        "/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone /p:CodesignKeychain=/user/build/_xamariniostasktmp.keychain /p:Codesignkey=iPhone Developer: XamariniOS Tester (HE432Y3E2Q) /p:CodesignProvision=testuuid": {
            "code": 0,
            "stdout": "xbuild"
        },
        "/usr/bin/security create-keychain -p _xamariniostask_TmpKeychain_Pwd#1 /user/build/_xamariniostasktmp.keychain" : {
            "code": 0,
            "stdout": "temporary keychain created"
        },
        "/usr/bin/security set-keychain-settings -lut 7200 /user/build/_xamariniostasktmp.keychain": {
            "code": 0,
            "stdout": "set-keychain-settings on temporary keychain output"
        },
        "/usr/bin/security unlock-keychain -p _xamariniostask_TmpKeychain_Pwd#1 /user/build/_xamariniostasktmp.keychain": {
            "code": 0,
            "stdout": "temporary keychain unlocked"
        },
        "/usr/bin/security import /user/build/cert.p12 -P p12password -A -t cert -f pkcs12 -k /user/build/_xamariniostasktmp.keychain": {
            "code": 0,
            "stdout": "p12 imported into temporary keychain"
        },
        "/usr/bin/security find-identity -v -p codesigning /user/build/_xamariniostasktmp.keychain" : {
            "code": 0,
            "stdout": "1) 5229BFC905F473E52FAD51208174528106966930 \"iPhone Developer: XamariniOS Tester (HE432Y3E2Q)\"\n 1 valid identities found"
        },
        "/usr/bin/security cms -D -i /user/build/testuuid.mobileprovision": {
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
            "stdout":  "/User/test/Library/Keychains/login.keychain \n /user/build/_xamariniostasktmp.keychain"
        },
        "/usr/bin/security list-keychain -d user -s /user/build/_xamariniostasktmp.keychain /User/test/Library/Keychains/login.keychain /user/build/_xamariniostasktmp.keychain": {
            "code": 0,
            "stdout": "list-keychain output here"
        },
        "/bin/cp -f /user/build/testuuid.mobileprovision /user/home/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision" : {
            "code": 0,
            "stdout": "provisioning profile copied"
        }
    },
    "checkPath" : {
        "/home/bin/xbuild": true,
        "/home/bin/nuget": true,
        "src/project.sln": true,
        "/usr/bin/security": true,
        "/usr/libexec/PlistBuddy": true,
        "/bin/rm": true,
        "/bin/cp": true
    },
    "exist": {
        "/user/build/cert.p12": true,
        "/user/build/testuuid.mobileprovision": true
    },
    "stats": {
        "/user/build": {
            "isFile": false
        }
    }
};
tr.setAnswers(a);

tr.run();


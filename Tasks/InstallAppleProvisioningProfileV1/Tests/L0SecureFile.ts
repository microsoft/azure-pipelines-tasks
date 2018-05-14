import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'preinstallprovprofile.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('provisioningProfileLocation', 'secureFiles');
tr.setInput('provProfileSecureFile', 'mySecureFileId');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['HOME'] = '/users/test';

let secureFileHelperMock = require('securefiles-common/securefiles-common-mock');
tr.registerMock('securefiles-common/securefiles-common', secureFileHelperMock);

tr.registerMock('fs', {
    writeFileSync: function (filePath, contents) {
    }
});

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "security": "/usr/bin/security",
        "/usr/libexec/PlistBuddy": "/usr/libexec/PlistBuddy",
        "rm": "/bin/rm",
        "cp": "/bin/cp"
    },
    "checkPath": {
        "/usr/bin/security": true,
        "/usr/libexec/PlistBuddy": true,
        "/bin/rm": true,
        "/bin/cp": true
    },
    "exist": {
        "/build/temp/mySecureFileId.filename": true
    },
    "exec": {
        "/usr/bin/security cms -D -i /build/temp/mySecureFileId.filename": {
            "code": 0,
            "stdout": "prov profile details here"
        },
        "/usr/libexec/PlistBuddy -c Print UUID _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "testuuid"
        },
        "/usr/libexec/PlistBuddy -c Print Name _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "testprovname"
        },
        "/bin/cp -f /build/temp/mySecureFileId.filename /users/test/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision": {
            "code": 0,
            "stdout": "provisioning profile copied"
        },
        "/bin/rm -f _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "delete output here"
        }
    }
};
tr.setAnswers(a);

tr.run();


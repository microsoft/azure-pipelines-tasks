import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'preinstallprovprofile.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('provisioningProfileLocation', 'secureFiles');
tr.setInput('provProfileSecureFile', 'mySecureFileId');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['HOME'] = '/users/test';

const secureFileHelperMock = require('azure-pipelines-tasks-securefiles-common/securefiles-common-mock');
secureFileHelperMock.SecureFileHelpers.setFileExtension(".mobileprovision");

tr.registerMock('azure-pipelines-tasks-securefiles-common/securefiles-common', secureFileHelperMock);

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
        "/build/temp/mySecureFileId.mobileprovision": true
    },
    "exec": {
        "/usr/bin/security cms -D -i /build/temp/mySecureFileId.mobileprovision": {
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
        "/bin/cp -f /build/temp/mySecureFileId.mobileprovision /users/test/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision": {
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

os.platform = () => {
    return 'darwin';
}
tr.registerMock('os', os);

tr.run();


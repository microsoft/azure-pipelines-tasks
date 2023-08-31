import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'postinstallprovprofile.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('removeProfile', 'true');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['VSTS_TASKVARIABLE_APPLE_PROV_PROFILE_UUID'] = 'testuuid';
process.env['HOME'] = '/users/test';

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "rm": "/bin/rm"
    },
    "checkPath": {
        "/bin/rm": true
    },
    "exist": {
        "/build/temp/mySecureFileId.filename": true,
        "/users/test/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision": true
    },
    "findMatch": {
        "testuuid*": [
            "/users/test/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision"
        ]
    },
    "exec": {
        "/bin/rm -f /users/test/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision": {
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


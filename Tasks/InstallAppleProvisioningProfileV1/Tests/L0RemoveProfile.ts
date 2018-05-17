import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'postinstallprovprofile.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('removeProfile', 'true');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['VSTS_TASKVARIABLE_APPLE_PROV_PROFILE_UUID'] = 'testuuid';
process.env['HOME'] = '/users/test';

tr.registerMock('fs', {
    writeFileSync: function (filePath, contents) {
    },
    statSync: fs.statSync,
    readFileSync: fs.readFileSync
});

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
    "exec": {
        "/bin/rm -f /users/test/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision": {
            "code": 0,
            "stdout": "delete output here"
        }
    }
};
tr.setAnswers(a);

tr.run();


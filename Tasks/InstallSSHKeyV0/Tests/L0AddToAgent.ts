import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'preinstallsshkey.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('provProfileSecureFile', 'mySecureFileId');

process.env['AGENT_VERSION'] = '2.117.0';
process.env['AGENT_TEMPDIRECTORY'] = '/build/temp';
process.env['AGENT_HOMEDIRECTORY'] = '';

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
        "rm": "/bin/rm",
        "cp": "/bin/cp"
    },
    "checkPath": {
        "/usr/bin/security": true,
        "/bin/rm": true,
        "/bin/cp": true
    },
    "exist": {
        "/build/temp/mySecureFileId.filename": true
    },
    "exec": {
        "/usr/bin/security cms -D -i /build/temp/mySecureFileId.filename": {
            "code": 0,
            "stdout": "ssh key details here"
        },
    }
};
tr.setAnswers(a);

tr.run();


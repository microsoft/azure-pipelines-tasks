import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'preinstallprovprofile.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('provProfileSource', 'Repo');
tr.setInput('provProfileFilePath', '**/*.mobileprovision');

process.env['AGENT_VERSION'] = '2.115.0';
process.env['AGENT_TEMPDIRECTORY'] = '/build/temp';

tr.registerMock('fs', {
    writeFileSync: function (filePath, contents) {
    },
    statSync: fs.statSync,
    readFileSync: fs.readFileSync
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
    "findMatch": {
        "**/*.mobileprovision": [
            "/user/build/myProvProfile.mobileprovision"
        ]
    },
    "exist": {
        "/user/build/myProvProfile.mobileprovision": true
    },
    "exec": {
        "/usr/bin/security cms -D -i /user/build/myProvProfile.mobileprovision": {
            "code": 0,
            "stdout": "prov profile details here"
        },
        "/usr/libexec/PlistBuddy -c Print UUID _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "testuuid"
        },
        "/bin/cp -f /user/build/myProvProfile.mobileprovision /Users/madhurig/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision": {
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


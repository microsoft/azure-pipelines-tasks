import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

import * as sinon from 'sinon';

let taskPath = path.join(__dirname, '..', 'androidsigning.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/path/a.apk');
tr.setInput('jarsign', 'true');
tr.setInput('keystoreFile', 'keystoreFileId');
tr.setInput('keystorePass', 'pass1');
tr.setInput('keystoreAlias', 'somealias');
tr.setInput('keyPass', 'pass2');
tr.setInput('zipalign', 'false');

const getTaskVariable = sinon.stub();
getTaskVariable.withArgs('KEYSTORE_FILE_PATH').returns('/some/store');
tr.registerMockExport('getTaskVariable', getTaskVariable);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "findMatch": {
        "/some/path/a.apk": [
            "/some/path/a.apk"
        ]
    },
    "checkPath": {
        "/some/path/a.apk": true
    },
    "which": {
        "jarsigner": "/usr/bin/jarsigner"
    },
    "exec": {
        "/usr/bin/jarsigner -keystore /some/store -storepass pass1 -keypass pass2 -signedjar /some/path/a.apk /some/path/a.apk.unsigned somealias": {
            "code": 0,
            "stdout": "jarsigner output here"
        }
    }
};
tr.setAnswers(a);

tr.run();

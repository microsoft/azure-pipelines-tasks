import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

import * as sinon from 'sinon';

let taskPath = path.join(__dirname, '..', 'androidsigning.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/path/a.apk');
tr.setInput('jarsign', 'true');
tr.setInput('zipalign', 'true');

const getVariable = sinon.stub();
getVariable.withArgs('JAVA_HOME').returns('');
tr.registerMockExport('getVariable', getVariable);

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

    }
};
tr.setAnswers(a);

tr.run();

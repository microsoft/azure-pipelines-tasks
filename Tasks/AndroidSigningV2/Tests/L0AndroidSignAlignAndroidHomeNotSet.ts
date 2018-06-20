import * as path from 'path';

import * as ma from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';

import * as sinon from 'sinon';

let taskPath = path.join(__dirname, '..', 'androidsigning.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const getInput = sinon.stub();
getInput.withArgs('files').returns('/some/path/a.apk');
tr.registerMockExport('getInput', getInput);

const getBoolInput = sinon.stub();
getBoolInput.withArgs('jarsign').returns(false);
getBoolInput.withArgs('zipalign').returns(true);
tr.registerMockExport('getBoolInput', getBoolInput);

const getVariable = sinon.stub();
getVariable.withArgs('ANDROID_HOME').returns('');
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

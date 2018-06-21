import * as path from 'path';

import * as ma from 'vsts-task-lib/mock-answer';
import { TaskMockRunner } from 'vsts-task-lib/mock-run';

import * as sinon from 'sinon';

const taskPath = path.join(__dirname, '..', 'androidsigning.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('files', '/some/path/a.apk');
taskRunner.setInput('jarsign', 'true');
taskRunner.setInput('zipalign', 'true');

const getVariable = sinon.stub();
getVariable.withArgs('JAVA_HOME').returns('');
taskRunner.registerMockExport('getVariable', getVariable);

const getTaskVariable = sinon.stub();
getTaskVariable.withArgs('KEYSTORE_FILE_PATH').returns('/some/store');
taskRunner.registerMockExport('getTaskVariable', getTaskVariable);

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
taskRunner.setAnswers(a);

taskRunner.run();

import * as path from 'path';

import * as ma from 'vsts-task-lib/mock-answer';
import { TaskMockRunner } from 'vsts-task-lib/mock-run';

import * as sinon from 'sinon';

const taskPath = path.join(__dirname, '..', 'androidsigning.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('files', '/some/path/nonexistent.apk');
taskRunner.setInput('jarsign', 'true');
taskRunner.setInput('zipalign', 'true');

const getVariable = sinon.stub();
getVariable.withArgs('AGENT_VERSION').returns('2.116.0');
getVariable.withArgs('HOME').returns('/users/test');
getVariable.withArgs('JAVA_HOME').returns('/fake/java/home');
getVariable.withArgs('ANDROID_HOME').returns('/fake/android/home');
taskRunner.registerMockExport('getVariable', getVariable);

const getTaskVariable = sinon.stub();
getTaskVariable.withArgs('KEYSTORE_FILE_PATH').returns('/some/store');
taskRunner.registerMockExport('getTaskVariable', getTaskVariable);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "findMatch": {
        "/some/path/nonexistent.apk": [
        ]
    }
};
taskRunner.setAnswers(a);

taskRunner.run();





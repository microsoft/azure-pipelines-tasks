import * as path from 'path';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

import * as sinon from 'sinon';

const taskPath: string = path.join(__dirname, '..', 'androidsigning.js');
const taskRunner = new TaskMockRunner(taskPath);

const getInput = sinon.stub();
getInput.withArgs('files').returns('/some/path/a.apk');
getInput.withArgs('keystoreFile').returns('keystoreFileId');
getInput.withArgs('keystorePass').returns('pass1');
getInput.withArgs('keystoreAlias').returns('somealias');
getInput.withArgs('keyPass').returns('pass2');
taskRunner.registerMockExport('getInput', getInput);

const getBoolInput = sinon.stub();
getBoolInput.withArgs('jarsign').returns(true);
getBoolInput.withArgs('zipalign').returns(false);
taskRunner.registerMockExport('getBoolInput', getBoolInput);

const getTaskVariable = sinon.stub();
getTaskVariable.withArgs('KEYSTORE_FILE_PATH').returns('/some/store');
taskRunner.registerMockExport('getTaskVariable', getTaskVariable);

taskRunner.setAnswers({
    findMatch: {
        "/some/path/a.apk": [
            "/some/path/a.apk"
        ]
    },
    checkPath: {
        "/some/path/a.apk": true
    },
    which: {
        "jarsigner": "/usr/bin/jarsigner"
    },
    exec: {
        "/usr/bin/jarsigner -keystore /some/store -storepass pass1 -keypass pass2 -signedjar /some/path/a.apk /some/path/a.apk.unsigned somealias": {
            "code": 0,
            "stdout": "jarsigner output here"
        }
    }
});

taskRunner.run();

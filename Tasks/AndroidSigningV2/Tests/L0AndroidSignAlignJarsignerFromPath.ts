import * as path from 'path';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

import * as sinon from 'sinon';

const taskPath = path.join(__dirname, '..', 'androidsigning.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('files', '/some/path/a.apk');
taskRunner.setInput('jarsign', 'true');
taskRunner.setInput('keystoreFile', 'keystoreFileId');
taskRunner.setInput('keystorePass', 'pass1');
taskRunner.setInput('keystoreAlias', 'somealias');
taskRunner.setInput('keyPass', 'pass2');
taskRunner.setInput('zipalign', 'false');

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

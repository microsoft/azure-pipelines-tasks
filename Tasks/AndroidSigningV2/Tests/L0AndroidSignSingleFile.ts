import * as path from 'path';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

import * as sinon from 'sinon';

const taskPath = path.join(__dirname, '..', 'androidsigning.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('files', '/some/fake.apk');

taskRunner.setInput('keystoreFile', '/some/store');
taskRunner.setInput('keystorePass', 'pass1');
taskRunner.setInput('keystoreAlias', 'somealias');
taskRunner.setInput('keyPass', 'pass2');

const getBoolInput = sinon.stub();
getBoolInput.withArgs('jarsign').returns(true);
getBoolInput.withArgs('zipalign').returns(false);
taskRunner.registerMockExport('getBoolInput', getBoolInput);

const getVariable = sinon.stub();
getVariable.withArgs('AGENT_VERSION').returns('2.116.0');
getVariable.withArgs('HOME').returns('/users/test');
getVariable.withArgs('JAVA_HOME').returns('/fake/java/home');
getVariable.withArgs('ANDROID_HOME').returns('/fake/android/home');
taskRunner.registerMockExport('getVariable', getVariable);

const getTaskVariable = sinon.stub();
getTaskVariable.withArgs('KEYSTORE_FILE_PATH').returns('/some/store');
taskRunner.registerMockExport('getTaskVariable', getTaskVariable);

taskRunner.setAnswers({
    checkPath: {
        "/some/fake.apk": true
    },
    findMatch: {
        "/some/fake.apk": [
            "/some/fake.apk"
        ],
        "/fake/android/home": [
            "/fake/android/home/sdk1",
            "/fake/android/home/sdk2"
        ],
        "zipalign*": [
            "/fake/android/home/sdk1/zipalign",
            "/fake/android/home/sdk2/zipalign"
        ]
    },
    exec: {
        "/fake/java/home/bin/jarsigner -keystore /some/store -storepass pass1 -keypass pass2 -signedjar /some/fake.apk /some/fake.apk.unsigned somealias": {
            "code": 0,
            "stdout": "jarsigner output here"
        },
        "/fake/android/home/sdk1/zipalign -v 4 /some/fake.apk.unaligned /some/fake.apk": {
            "code": 0,
            "stdout": "zipalign output here"
        }
    }
});

taskRunner.run();

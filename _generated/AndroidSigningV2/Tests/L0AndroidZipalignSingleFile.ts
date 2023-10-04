import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'androidsigning.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/fake.apk');
tr.setInput('jarsign', 'true');
tr.setInput('keystoreFile', '/some/store');
tr.setInput('keystorePass', 'pass1');
tr.setInput('keystoreAlias', 'somealias');
tr.setInput('jarsign', 'false');
tr.setInput('zipalign', 'true');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['VSTS_TASKVARIABLE_KEYSTORE_FILE_PATH'] = '/some/store';
process.env['HOME'] = '/users/test';
process.env['JAVA_HOME'] = '/fake/java/home';
process.env['ANDROID_HOME'] = '/fake/android/home';

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath": {
        "/some/fake.apk": true
    },
    "findMatch": {
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
    "exec": {
        "/fake/java/home/bin/jarsigner -keystore /some/store -storepass pass1 -keypass pass2 -signedjar /some/fake.apk /some/fake.apk.unsigned somealias": {
            "code": 0,
            "stdout": "jarsigner output here"
        },
        "/fake/android/home/sdk1/zipalign -v 4 /some/fake.apk.unaligned /some/fake.apk": {
            "code": 0,
            "stdout": "zipalign output here"
        }
    }
};
tr.setAnswers(a);

tr.run();
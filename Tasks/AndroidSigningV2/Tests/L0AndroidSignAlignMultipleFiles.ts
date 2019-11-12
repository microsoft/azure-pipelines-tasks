import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'androidsigning.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/path/*.apk');
tr.setInput('jarsign', 'true');
tr.setInput('keystoreFile', '/some/store');
tr.setInput('keystorePass', 'pass1');
tr.setInput('keystoreAlias', 'somealias');
tr.setInput('keyPass', 'pass2');
tr.setInput('zipalign', 'true');

process.env['VSTS_TASKVARIABLE_KEYSTORE_FILE_PATH'] = '/some/store';
process.env['JAVA_HOME'] = '/fake/java/home';
process.env['ANDROID_HOME'] = '/fake/android/home';

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exec": {
        "/fake/java/home/bin/jarsigner -keystore /some/store -storepass pass1 -keypass pass2 -signedjar /some/path/a.apk /some/path/a.apk.unsigned somealias": {
            "code": 0,
            "stdout": "jarsigner output here"
        },
        "/fake/java/home/bin/jarsigner -keystore /some/store -storepass pass1 -keypass pass2 -signedjar /some/path/b.apk /some/path/b.apk.unsigned somealias": {
            "code": 0,
            "stdout": "jarsigner output here"
        },
        "/fake/android/home/sdk1/zipalign -v 4 /some/path/a.apk.unaligned /some/path/a.apk": {
            "code": 0,
            "stdout": "zipalign output here"
        },
        "/fake/android/home/sdk1/zipalign -v 4 /some/path/b.apk.unaligned /some/path/b.apk": {
            "code": 0,
            "stdout": "zipalign output here"
        }
    },
    "checkPath": {
        "/some/path/a.apk": true,
        "/some/path/b.apk": true
    },
    "findMatch": {
        "/some/path/*.apk": [
            "/some/path/a.apk",
            "/some/path/b.apk"
        ],
        "/fake/android/home": [
            "/fake/android/home/sdk1",
            "/fake/android/home/sdk2"
        ],
        "zipalign*": [
            "/fake/android/home/sdk1/zipalign",
            "/fake/android/home/sdk2/zipalign"
        ]
    }
}

tr.setAnswers(a);

tr.run();


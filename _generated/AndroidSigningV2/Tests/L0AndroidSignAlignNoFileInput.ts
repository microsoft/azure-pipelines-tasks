import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'androidsigning.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/path/nonexistent.apk');
tr.setInput('jarsign', 'true');
tr.setInput('zipalign', 'true');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['VSTS_TASKVARIABLE_KEYSTORE_FILE_PATH'] = '/usr/lib/login.keystore';
process.env['HOME'] = '/users/test';
process.env['JAVA_HOME'] = '/fake/java/home';
process.env['ANDROID_HOME'] = '/fake/android/home';

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "findMatch": {
        "/some/path/nonexistent.apk": [
        ]
    }
};
tr.setAnswers(a);

tr.run();





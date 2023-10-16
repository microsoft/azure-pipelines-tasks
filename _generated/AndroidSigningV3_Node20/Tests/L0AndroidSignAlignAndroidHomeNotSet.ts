import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'androidsigning.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/path/a.apk');
tr.setInput('apksign', 'false');
tr.setInput('zipalign', 'true');

process.env['VSTS_TASKVARIABLE_KEYSTORE_FILE_PATH'] = '/some/store';
process.env['ANDROID_HOME'] = '';

// provide answers for task mock
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    findMatch: {
        '/some/path/a.apk': [
            '/some/path/a.apk'
        ]
    },
    checkPath: {
        '/some/path/a.apk': true
    }
};
tr.setAnswers(a);

tr.run();

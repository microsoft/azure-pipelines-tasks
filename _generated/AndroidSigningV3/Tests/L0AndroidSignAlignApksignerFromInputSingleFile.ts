import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'androidsigning.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/path/a.apk');
tr.setInput('apksignerLocation', '/usr/bin/apksigner');
tr.setInput('apksign', 'true');
tr.setInput('keystoreFile', '/some/store');
tr.setInput('keystorePass', 'pass1');
tr.setInput('keystoreAlias', 'somealias');
tr.setInput('keyPass', 'pass2');
tr.setInput('zipalign', 'false');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['VSTS_TASKVARIABLE_KEYSTORE_FILE_PATH'] = '/some/store';
process.env['HOME'] = '/users/test';
process.env['ANDROID_HOME'] = '/fake/android/home';

// provide answers for task mock
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    findMatch: {
        '/some/path/a.apk': [
            '/some/path/a.apk'
        ]
    },
    checkPath: {
        '/some/path/a.apk': true
    },
    exec: {
        '/usr/bin/apksigner sign --ks /some/store --ks-pass pass:pass1 --ks-key-alias somealias --key-pass pass:pass2 /some/path/a.apk': {
            'code': 0,
            'stdout': 'apksigner output here'
        }
    }
};
tr.setAnswers(a);

tr.run();
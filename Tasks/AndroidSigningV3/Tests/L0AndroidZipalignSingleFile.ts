import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'androidsigning.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/fake.apk');
tr.setInput('apksign', 'false');
tr.setInput('zipalign', 'true');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['VSTS_TASKVARIABLE_KEYSTORE_FILE_PATH'] = '/some/store';
process.env['HOME'] = '/users/test';
process.env['ANDROID_HOME'] = '/fake/android/home';

// provide answers for task mock
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        '/some/fake.apk': true
    },
    'findMatch': {
        '/some/fake.apk': [
            '/some/fake.apk'
        ],
        'zipalign*': [
            '/fake/android/home/sdk1/zipalign',
            '/fake/android/home/sdk2/zipalign'
        ]
    },
    'exec': {
        '/fake/android/home/sdk1/zipalign -v 4 /some/fake.apk.unaligned /some/fake.apk': {
            'code': 0,
            'stdout': 'zipalign output here'
        }
    }
};
tr.setAnswers(a);

tr.run();
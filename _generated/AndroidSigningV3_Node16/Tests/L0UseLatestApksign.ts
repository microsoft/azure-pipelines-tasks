import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'androidsigning.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/path/*.apk');
tr.setInput('apksign', 'true');
tr.setInput('keystoreFile', '/some/store');
tr.setInput('keystorePass', 'pass1');
tr.setInput('keystoreAlias', 'somealias');
tr.setInput('keyPass', 'pass2');
tr.setInput('zipalign', 'false');
tr.setInput('apksignerVersion', 'latest');

process.env['VSTS_TASKVARIABLE_KEYSTORE_FILE_PATH'] = '/some/store';
process.env['ANDROID_HOME'] = '/fake/android/home';

// provide answers for task mock
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    exec: {
        '/fake/android/home/29.0.2/apksigner sign --ks /some/store --ks-pass pass:pass1 --ks-key-alias somealias --key-pass pass:pass2 /some/path/a.apk': {
            'code': 0,
            'stdout': 'jarsigner output here'
        },
        '/fake/android/home/29.0.2/apksigner sign --ks /some/store --ks-pass pass:pass1 --ks-key-alias somealias --key-pass pass:pass2 /some/path/b.apk': {
            'code': 0,
            'stdout': 'jarsigner output here'
        }
    },
    checkPath: {
        '/some/path/a.apk': true,
        '/some/path/b.apk': true
    },
    findMatch: {
        '/some/path/*.apk': [
            '/some/path/a.apk',
            '/some/path/b.apk'
        ],
        'apksigner*\n!*.jar': [
            '/fake/android/home/26.0.3/apksigner',
            '/fake/android/home/29.0.2/apksigner',
            '/fake/android/home/28.0.0/apksigner'
        ]
    }
};
tr.setAnswers(a);

tr.run();
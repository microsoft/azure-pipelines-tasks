import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'decrypt.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);

process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = __dirname;

runner.setInput('cipher', process.env['cipher']);
runner.setInput('inFile', process.env['inFile']);
runner.setInput('outFile', process.env['outFile']);
runner.setInput('passphrase', process.env['passphrase']);

let a: mockanswer.TaskLibAnswers = <mockanswer.TaskLibAnswers>{
    'exec': {
        "path/to/openssl des3 -d -in encryptedTestFile.txt -out decryptedTestFile.txt -pass pass:very-secret-password": {
            "code": 0,
            "stdout": "decrypted test file"
        }
    },
    'which': {
        'openssl': 'path/to/openssl',
    },
    'checkPath': {
        'path/to/openssl': true
    }
};

runner.setAnswers(a);

runner.run();

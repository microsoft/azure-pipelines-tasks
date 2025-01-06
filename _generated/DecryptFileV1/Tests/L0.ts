import * as mocktest from 'azure-pipelines-task-lib/mock-test';
import assert = require('assert');
import path = require('path');

describe('DecryptFileV1 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    function runValidations(validator: () => void, tr: mocktest.MockTestRunner) {
        try {
            validator();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    }

    it('Successfully decrypt file', async () => {
        this.timeout(1000);

        process.env['cipher'] = 'des3';
        process.env['inFile'] = 'encryptedTestFile.txt';
        process.env['outFile'] = 'decryptedTestFile.txt';
        process.env['passphrase'] = 'very-secret-password';

        let tp: string = path.join(__dirname, 'L0DecryptFile.js');
        let tr: mocktest.MockTestRunner = new mocktest.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.stdout.indexOf('decrypted test file') > -1);
        }, tr);
    });
});

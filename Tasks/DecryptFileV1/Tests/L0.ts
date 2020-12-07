import * as mocktest from 'azure-pipelines-task-lib/mock-test';
import fs = require('fs');
import assert = require('assert');
import path = require('path');

describe('DecryptFileV1 Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr, done) {
        try {
            validator();
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    }

    it('Successfully decrypt file', (done: Mocha.Done) => {
        this.timeout(5000);
        process.env['cipher'] = 'des3';
        process.env['inFile'] = 'encryptedTestFile.txt';
        process.env['outFile'] = 'decryptedTestFile.txt';
        process.env['passphrase'] = 'very-secret-password';

        let tp: string = path.join(__dirname, 'LoDecryptFile.js');
        let tr: mocktest.MockTestRunner = new mocktest.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.stdout.indexOf('decrypted test file') > -1);
        }, tr, done);
    });
});

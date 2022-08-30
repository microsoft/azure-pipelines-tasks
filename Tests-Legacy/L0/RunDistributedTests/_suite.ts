import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
var psr = null;

describe('Deploy Test Agent Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        if (psm.testSupported()) {
            psr = new psm.PSRunner();
            psr.start();
        }

        done();
    });

    after(function () {
        if (psr) {
            psr.kill();
        }
    });

    if (psm.testSupported()) {
        it('(RunDistributedTests-VerifyAzureCompat.NewResource) verifies if new DTA bits are available for supporting Azure Env', (done) => {
            psr.run(path.join(__dirname, 'VerifyAzureCompat.NewResource.ps1'), done);
        })
        it('(RunDistributedTests-VerifyAzureCompat.OldResource) verifies if new DTA bits are not available for supporting Azure Env, fall back to old run', (done) => {
            psr.run(path.join(__dirname, 'VerifyAzureCompat.OldResource.ps1'), done);
        })
    }
});
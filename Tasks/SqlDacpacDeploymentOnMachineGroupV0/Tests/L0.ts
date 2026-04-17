/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import fs = require('fs');
import assert = require('assert');
import path = require('path');

const psm = require('../../../Tests/lib/psRunner');
let psr = null;

describe('SqlServerDacpacDeploymentOnMachineGroupV0 Suite', function () {
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

    it('Does a basic hello world test', function(done: MochaDone) {
        // TODO - add real tests
        done();
    });
});

describe('SqlDacpacDeploymentOnMachineGroupV0 - Security Functions Suite', function () {
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
        it('Validate security functions (helpers, FF logic, CLI splitter, injection prevention)', (done) => {
            psr.run(path.join(__dirname, 'L0SecurityFunctions.ps1'), done);
        });
    }
});

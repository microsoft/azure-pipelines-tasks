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

    if (psm.testSupported()) {
        it('Validate additional args validation blocks injection when FF enabled', (done) => {
            psr.run(path.join(__dirname, 'L0ArgValidationEnabled.ps1'), done);
        });

        it('Validate additional args validation allows injection when FF disabled', (done) => {
            psr.run(path.join(__dirname, 'L0ArgValidationDisabled.ps1'), done);
        });

        it('Validate additional args validation allows clean args when FF enabled', (done) => {
            psr.run(path.join(__dirname, 'L0ArgValidationClean.ps1'), done);
        });
    }
});

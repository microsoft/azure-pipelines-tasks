/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import fs = require('fs');
import assert = require('assert');
import path = require('path');

const psm = require('../../../Tests/lib/psRunner');
let psr = null;

describe('AzureCloudPowerShellDeploymentV1 Suite', function () {
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

    it('Does a basic hello world test', function(done: MochaDone) {
        // TODO - add real tests
        done();
    });

    if (psm.testSupported()) {
        it('formats filename diagnostics without changing paths', done => {
            psr.run(path.join(__dirname, 'FilenameDiagnostics.ps1'), done);
        });
        it('Wires Invoke-ScriptArgumentSanitization onto NewServiceAdditionalArguments (MSRC 115118 Bug 2)', (done) => {
            psr.run(path.join(__dirname, 'L0NewServiceAdditionalArgumentsSanitizerWiring.ps1'), done);
        });
    }
});

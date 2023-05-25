/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import fs = require('fs');
import assert = require('assert');
import path = require('path');

const psm = require('../../../Tests/lib/psRunner');
let psr = null;

describe('AzureCloudPowerShellDeploymentV2 Suite', function () {
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

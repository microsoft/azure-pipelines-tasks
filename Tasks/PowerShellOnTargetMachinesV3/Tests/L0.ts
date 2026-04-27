/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import fs = require('fs');
import assert = require('assert');
import path = require('path');

const psm = require('../../../Tests/lib/psRunner');
let psr = null;

describe('PowerShellOnTargetMachineV3 Suite', function () {
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
        it('Sanitizes ScriptArguments when feature flag is enabled', (done) => {
            psr.run(path.join(__dirname, 'L0SanitizerEnabled.ps1'), done);
        });
        it('Skips sanitization when feature flag is disabled', (done) => {
            psr.run(path.join(__dirname, 'L0SanitizerDisabled.ps1'), done);
        });
        it('Skips sanitization for inline scripts', (done) => {
            psr.run(path.join(__dirname, 'L0SanitizerSkippedForInline.ps1'), done);
        });
    }
});

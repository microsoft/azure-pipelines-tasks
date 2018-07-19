/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');

var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('AzureAutomation Suite', function () {
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
        it('Validate with valid inputs to deploy runbook job', (done) => {
            psr.run(path.join(__dirname, 'ValidRunbookInputs.ps1'), done);
        })
    }
});

describe('AzureAutomation - StartAzureAutomationRunbook Suite', function () {
    this.timeout(10000);

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
        it('Validate with valid inputs to deploy dsc configurations', (done) => {
            psr.run(path.join(__dirname, 'ValidDscInputs.ps1'), done);
        })
    }
});

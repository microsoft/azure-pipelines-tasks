/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');

var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('DeployToAzureAutomation  Suite', function () {
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

        it('Validate with valid inputs', (done) => {            
            psr.run(path.join(__dirname, 'L0ValidAzureAutomationAuthentication.ps1'), done);
        });
    }
});

describe('DeployToAzureAutomation - ImportAzureAutomationRunbook Suite', function () {
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

        it('Validate with valid inputs', (done) => {            
            psr.run(path.join(__dirname, 'L0ValidRunbookImport.ps1'), done);
        });
    }
});

describe('DeployToAzureAutomation - StartAzureAutomationRunbook Suite', function () {
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

        it('Validate with valid inputs', (done) => {            
            psr.run(path.join(__dirname, 'L0ValidRunbookStart.ps1'), done);
        });
    }
});

describe('DeployToAzureAutomation - ImportAzureAutomationDscConfiguration Suite', function () {
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
            psr.run(path.join(__dirname, 'L0ValidDscImport.ps1'), done);
        })
    }
});

describe('DeployToAzureAutomation - DeployAzureAutomationDscConfiguration Suite', function () {
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

        it('Validate with valid inputs', (done) => {            
            psr.run(path.join(__dirname, 'L0ValidDscDeploy.ps1'), done);
        });
    }
});


describe('DeployToAzureAutomation - ImportAzureAutomationModules Suite', function () {
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
        it('Validate with valid inputs to deploy dsc configurations', (done) => {
            psr.run(path.join(__dirname, 'L0ValidModuleImport.ps1'), done);
        })
    }
});

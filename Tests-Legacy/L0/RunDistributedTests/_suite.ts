/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

describe('Deploy Test Agent Suite', function () {
    this.timeout(20000);

    before((done) => {
        if (ps) {
            psr = new psm.PSRunner();
            psr.start();
        }

        done();
    });

    after(function () {
        psr.kill();
    });

    if (ps) {
        it('(RunDistributedTests-VerifyAzureCompat.NewResource) verifies if new DTA bits are available for supporting Azure Env', (done) => {
            psr.run(path.join(__dirname, 'VerifyAzureCompat.NewResource.ps1'), done);
        })
        it('(RunDistributedTests-VerifyAzureCompat.OldResource) verifies if new DTA bits are not available for supporting Azure Env, fall back to old run', (done) => {
            psr.run(path.join(__dirname, 'VerifyAzureCompat.OldResource.ps1'), done);
        })
    }
});
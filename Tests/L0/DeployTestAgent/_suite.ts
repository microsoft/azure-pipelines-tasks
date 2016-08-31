/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

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
        it('(DeployTestAgent-ThrowIfPATNotExists) throws if no personal authentication token exists', (done) => {
            psr.run(path.join(__dirname, 'ThrowIfPATNotExists.ps1'), done);
        })
        it('(DeployTestAgent-VerifyCompat.WindowsAgent) verifies if deploy test agent compat with windows agent', (done) => {
            psr.run(path.join(__dirname, 'VerifyCompat.WindowsAgent.ps1'), done);
        })
        it('(DeployTestAgent-VerifyCompat.CoreCLRAgent) verifies if deploy test agent compat with coreclr agent', (done) => {
            psr.run(path.join(__dirname, 'VerifyCompat.CoreCLRAgent.ps1'), done);
        })
        it('(DeployTestAgent-VerifyParameters) verifies if deploy test agent is called with the right parameters', (done) => {
            psr.run(path.join(__dirname, 'VerifyParameters.ps1'), done);
        })
    }
});
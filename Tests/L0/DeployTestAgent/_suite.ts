/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell');
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
        it('(DeployTestAgent-VerifyAzureCompat.NewResource) verifies if register environment is called for supported env', (done) => {
            psr.run(path.join(__dirname, 'VerifyAzureCompat.NewResource.ps1'), done);
        })
        it('(DeployTestAgent-VerifyAzureCompat.OldResource) verifies if old deploy test agent is called for non-supported flat machine env', (done) => {
            psr.run(path.join(__dirname, 'VerifyAzureCompat.OldResource.ps1'), done);
        })
        it('(DeployTestAgent-VerifyParameters) verifies if deploy test agent is called with the right parameters', (done) => {
            psr.run(path.join(__dirname, 'VerifyParameters.ps1'), done);
        })
    }
});
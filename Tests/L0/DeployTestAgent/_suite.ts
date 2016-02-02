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

describe('Deploy Test Agent Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('(DeployTestAgent-ThrowIfPATNotExists) throws if no personal authentication token exists', (done) => {
            psm.runPS(path.join(__dirname, 'ThrowIfPATNotExists.ps1'), done);
        })
        it('(DeployTestAgent-VerifyAzureCompat.NewResource) verifies if register environment is called for supported env', (done) => {
            psm.runPS(path.join(__dirname, 'VerifyAzureCompat.NewResource.ps1'), done);
        })
        it('(DeployTestAgent-VerifyAzureCompat.OldResource) verifies if old deploy test agent is called for non-supported flat machine env', (done) => {
            psm.runPS(path.join(__dirname, 'VerifyAzureCompat.OldResource.ps1'), done);
        })
    }
});
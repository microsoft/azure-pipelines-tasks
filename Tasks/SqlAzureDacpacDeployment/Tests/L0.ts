/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>


import Q = require('q');
import assert = require('assert');
import path = require('path');

var psm = require('../../../Tests/lib/psRunner');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

describe('SqlAzureDacpacDeployment - Utility (Create-AzureSqlDatabaseServerFirewallRule) Suite', function () {
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

    if(ps) {
        it('Validate Username end point', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityUsername.ps1'), done);
        });
        it('Validate SPN end point', (done) => {
            psr.run(path.join(__dirname, 'L0UtilitySPN.ps1'), done);
        });
        it('Validate Certificate end point', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityCertificate.ps1'), done);
        });
    }
});


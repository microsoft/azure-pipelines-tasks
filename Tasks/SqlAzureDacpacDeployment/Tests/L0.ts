/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');

var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('SqlAzureDacpacDeployment  Suite', function () {
    this.timeout(20000);

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
        it('(DACPAC) Should throw if Multiple Dacpac files or none present', (done) => {
            psr.run(path.join(__dirname, 'L0DacpacTaskFileCheck.ps1'), done);
        });

        it('(SQL) Should throw if Multiple Sql files or none present', (done) => {
            psr.run(path.join(__dirname, 'L0SqlTaskFileCheck.ps1'), done);
        });
        it('(DACPAC) Should run successfully for all valid inputs', (done) => {
            psr.run(path.join(__dirname, 'L0ValidDacpacInput.ps1'), done);
        });
        it('(SQL) Should run successfully for all valid inputs', (done) => {
            psr.run(path.join(__dirname, 'L0ValidSqlInput.ps1'), done);
        });
    }
});

describe('SqlAzureDacpacDeployment - Utility Suite', function () {
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
        it('Validate Username end point (Create-AzureSqlDatabaseServerFirewallRule)', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityUsernameCreate.ps1'), done);
        });
        it('Validate SPN end point (Create-AzureSqlDatabaseServerFirewallRule) ', (done) => {
            psr.run(path.join(__dirname, 'L0UtilitySPNCreate.ps1'), done);
        });
        it('Validate Certificate end point (Create-AzureSqlDatabaseServerFirewallRule)', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityCertificateCreate.ps1'), done);
        });
        it('Validate Username end point (Delete-AzureSqlDatabaseServerFirewallRule)', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityUsernameDelete.ps1'), done);
        });
        it('Validate SPN end point (Delete-AzureSqlDatabaseServerFirewallRule)', (done) => {
            psr.run(path.join(__dirname, 'L0UtilitySPNDelete.ps1'), done);
        });
        it('Validate Certificate end point (Delete-AzureSqlDatabaseServerFirewallRule)', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityCertificateDelete.ps1'), done);
        });
        it('IP Address Range Check (Get-AgentIPAddress)', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityIPRange.ps1'), done);
        });
        it('Validate SQL Package Command Line Arguments (Get-SqlPackageCommandArguments)', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityGetSqlCmdArgs.ps1'), done);
        });
        it('Validate Username (Get-FormattedSqlUsername)', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityFormatUsername.ps1'), done);
        });
    }
});

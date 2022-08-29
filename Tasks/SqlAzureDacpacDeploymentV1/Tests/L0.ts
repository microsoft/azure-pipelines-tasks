import Q = require('q');
import assert = require('assert');
import path = require('path');

var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('SqlAzureDacpacDeployment  Suite', function () {
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
            psr.run(path.join(__dirname, 'L0ValidSqlAzureInputs.ps1'), done);
        });
    }
});

describe('SqlAzureDacpacDeployment - SqlAzureActions Suite', function () {
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
        it ('Validate all SqlPackage.exe actions', (done) => {
            psr.run(path.join(__dirname, 'L0SqlPackageActions.ps1'), done);
        });

        it ('Validate Invoke-SqlCmd related actions', (done) => {
            psr.run(path.join(__dirname, 'L0SqlcmdTests.ps1'), done);
        });

        it ('Validate helper methods', (done) => {
            psr.run(path.join(__dirname, 'L0SqlAzureActionsUtilityTests.ps1'), done);
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
        it('Validate UtilityMethods (EscapeSpecialChars)', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityMethods.ps1'), done);
        });
        it('FindSqlPackagePath should give preference to msi installation over vs installation and sql server installation', (done) => {
            this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

            psr.run(path.join(__dirname, 'L0FindSqlPackagePath.ps1'), done);
        });
        it('FindSqlPackagePath should select highest version', (done) => {
            this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

            psr.run(path.join(__dirname, 'L0FindSqlPackagePathSelectHighestVersion.ps1'), done);
        });
    }
});

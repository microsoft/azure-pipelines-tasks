import Q = require('q');
import assert = require('assert');
import path = require('path');

var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('PowerShellOnTargetMachine Suite', function () {
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
        it('Validate Get-EnvironmentResources Command', (done) => {
            psr.run(path.join(__dirname, 'L0ValidateEnvResources.ps1'), done);
        });
        it('Validate Get-EnvironmentProperty Command', (done) => {
            psr.run(path.join(__dirname, 'L0ValidateEnvProperty.ps1'), done);
        });
        it('Throws if Invoke-PsOnRemote fails for a resource', (done) => {
            psr.run(path.join(__dirname, 'L0InvalidEnvFail.ps1'), done);
        });
        it('Performs deployment on all machines and works correctly for valid input for sequential run', (done) => {
            psr.run(path.join(__dirname, 'L0ValidSequentialRun.ps1'), done);
        });

        it('Performs deployment on all machines and works correctly for valid input for Parallel run', (done) => {
            psr.run(path.join(__dirname, 'L0ValidParallelRun.ps1'), done);
        });
        it('Throws if job fails for resources in parallel run', (done) => {
            psr.run(path.join(__dirname, 'L0ParallelRunFail.ps1'), done);
        });
        it('Performs deployment on all machines with same resource name', (done) => {
            psr.run(path.join(__dirname, 'L0ParallelRunDuplicate.ps1'), done);
        });
    }
});

describe('PowerShellOnTargetMachine - (Get-SkipCACheckOption and Get-ResourceWinRmConfig) Suite', function() {
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
        it('Test for an environment with Https/SkipCA property set', (done) => {
            psr.run(path.join(__dirname, 'L0SkipCAPropertyOnly.ps1'), done);
        });
        it('Test for an environment with Http property set and not Https/skiCA', (done) => {
            psr.run(path.join(__dirname, 'L0HttpProperty.ps1'), done);
        });
        it('Should throw exception saying both the protocols were not set', (done) => {
            psr.run(path.join(__dirname, 'L0NoHttp(s)AndskipCAProperty.ps1'), done);
        });
        it('Should try to get Http Port and not Https Port', (done) => {
            psr.run(path.join(__dirname, 'L0HttpAndNoSkipCA.ps1'), done);
        });
        it('Should try to get Http Port and not Https Port. Should throw when Http port not found', (done) => {
            psr.run(path.join(__dirname, 'L0SkipCAandNoHttpPort.ps1'), done);
        });
        it('Should try to get Https Port and not Http Port', (done) => {
            psr.run(path.join(__dirname, 'L0SkipCAandHttpsPort.ps1'), done);
        });
        it('Should try to get Https Port and not Http Port. Should throw when Https port not found', (done) => {
            psr.run(path.join(__dirname, 'L0SkipCAandNoHttpsPort.ps1'), done);
        }); 
    }
});

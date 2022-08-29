import Q = require('q');
import assert = require('assert');
import path = require('path');

var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('WindowsMachineFileCopy Suite', function () {
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
        it('Throw error if Source Path is invalid or empty', (done) => {
            psr.run(path.join(__dirname, 'L0ValidateSourcePath.ps1'), done);
        });
        it('Throw error if Destination Path is invalid or empty', (done) => {
            psr.run(path.join(__dirname, 'L0ValidateDestinationPath.ps1'), done);
        });
        it('Should copy on local machine when no machine name is given', (done) => {
            psr.run(path.join(__dirname, 'L0ShouldCopyOnLocalMachine.ps1'), done);
        });
        it('Validate Get-ResourcesProperties Utility', (done) => {
            psr.run(path.join(__dirname, 'L0GetResourcesProperties.ps1'), done);
        });
        it('Validate Get-ResourceConnectionDetails Utility', (done) => {
            psr.run(path.join(__dirname, 'L0GetResourceConnectionDetails.ps1'), done);
        });
        it('Throw Error for invalid machine names', (done) => {
            psr.run(path.join(__dirname, 'L0InvalidEnvironmentResource.ps1'), done);
        });
        it('Throw Error if Copy Files To Target Machine fails', (done) => {
            psr.run(path.join(__dirname, 'L0SequentialCopyFail.ps1'), done);
        });
        it('Performs Sequential copy on all machines and works correctly for valid input', (done) => {
            psr.run(path.join(__dirname, 'L0ValidInputSequentialCopy.ps1'), done);
        });
        it('Performs Parallel copy on all machines and works correctly for valid input', (done) => {
            psr.run(path.join(__dirname, 'L0ValidInputParallelCopy.ps1'), done);
        });
        it('Throw error if job fails for resource in Parallel Copy', (done) => {
           psr.run(path.join(__dirname, 'L0ParallelCopyFail.ps1'), done);
        });
    }
    else {
        console.warn('Cannot run tests for WindowsMachineFileCopy on Non-Windows Platform');
    }
});
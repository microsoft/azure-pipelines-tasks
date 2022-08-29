import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

describe('Remote Deployer Test Suite', function () {
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
        it('(Get-TargetMachines) uses correct port and machine name', (done) => {
            psr.run(path.join(__dirname, 'Get-TargetMachines.UsesCorrectPortForTargetMachine.ps1'), done);
        });

        it('(Get-WinRmConnectionToTargetMachine) throws if unable to create session', (done) => {
            psr.run(path.join(__dirname, 'Get-WinRmConnectionToTargetMachine.ThrowsIfUnableToCreateSession.ps1'), done);
        });
        
        it('(Retry-Connection) does not throw if cannot get pssession', (done) => {
            psr.run(path.join(__dirname, 'Retry-Connection.DoesNotThrowIfCannotGetSession.ps1'), done);
        });
        
        it('(Retry-Connection) does not throw if receive pssession throws', (done) => {
            psr.run(path.join(__dirname, 'Retry-Connection.DoesNotThrowIfReceiveSessionThrows.ps1'), done);
        });
        
        it('(Retry-Connection) does not attempt remote connection if session state is not disconnected and availability is not none', (done) => {
            psr.run(path.join(__dirname, 'Retry-Connection.AttemptsConnectionOnSpecificCondition.ps1'), done);
        });
        
        it('(Retry-Connection) attempts remote connection only if session state is disconnected and availability is none', (done) => {
            psr.run(path.join(__dirname, 'Retry-Connection.AttemptsConnectionStateDisconnectedAvailabilityNone.ps1'), done);
        });
    }
});
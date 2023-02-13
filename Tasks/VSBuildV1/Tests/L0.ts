import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('VSBuild Suite', function () {
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
        it('Get-VSPath use Reg Key', (done) => {
            psr.run(path.join(__dirname, 'Get-VSPath-Use-RegKey.ps1'), done);
        })
        it('Get-VSPath use vswhere', (done) => {
            psr.run(path.join(__dirname, 'Get-VSPath-Use-VsWhere.ps1'), done);
        })
        it('(Select-VSVersion) falls back from 14', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsBackFrom14.ps1'), done);
        })
        it('(Select-VSVersion) falls back from 15', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsBackFrom15.ps1'), done);
        })
        it('(Select-VSVersion) falls back from 16', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsBackFrom16.ps1'), done);
        })
        it('(Select-VSVersion) falls back from 17', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsBackFrom17.ps1'), done);
        })
        it('(Select-VSVersion) falls forward from 12', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsForwardFrom12.ps1'), done);
        })
        it('(Select-VSVersion) falls forward from 14', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsForwardFrom14.ps1'), done);
        })
        it('(Select-VSVersion) falls forward from 15', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsForwardFrom15.ps1'), done);
        })
        it('(Select-VSVersion) falls forward from 16', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsForwardFrom16.ps1'), done);
        })
        it('(Select-VSVersion) finds latest', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FindsLatest.ps1'), done);
        })
        it('(Select-VSVersion) finds preferred', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FindsPreferred.ps1'), done);
        })
        it('(Select-VSVersion) warns if not found', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.WarnsIfNotFound.ps1'), done);
        })
        it('maps vs versions', (done) => {
            psr.run(path.join(__dirname, 'MapsVSVersions.ps1'), done);
        })
        it('passes arguments', (done) => {
            psr.run(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
        it('throws if unknown vs version', (done) => {
            psr.run(path.join(__dirname, 'ThrowsIfUnknownVSVersion.ps1'), done);
        })
        it('warns if deprecated input specified', (done) => {
            psr.run(path.join(__dirname, 'WarnsIfDeprecatedInputSpecified.ps1'), done);
        })
    }
});
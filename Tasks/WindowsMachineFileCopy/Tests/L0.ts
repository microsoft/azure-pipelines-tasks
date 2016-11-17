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

describe('WindowsMachineFileCopy Suite', function () {
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
        it('Throw error if Source Path is invalid', (done) => {
            psr.run(path.join(__dirname, 'L0InvalidSourcePath.ps1'), done);
        });

        it('Throw error if Destination Path is invalid', (done) => {
            psr.run(path.join(__dirname, 'L0InvalidDestinationPath.ps1'), done);
        });

        it('Should copy on local machine when no machine name is given', (done) => {
            psr.run(path.join(__dirname, 'L0ShouldCopyOnLocalMachine.ps1'), done);
        });

        it('Throw Error for invalid machine names', (done) => {
            psr.run(path.join(__dirname, 'L0InvalidEnvironmentResource.ps1'), done);
        });

        it('Throw Error for Environment property not present', (done) => {
            psr.run(path.join(__dirname, 'L0InvalidGetEnvironmentProperty.ps1'), done);
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
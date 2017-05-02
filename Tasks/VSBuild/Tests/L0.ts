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

describe('VSBuild Suite', function () {
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
        it('(Select-VSVersion) errors if 15 not found', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.ErrorsIf15NotFound.ps1'), done);
        })
        it('(Select-VSVersion) falls back from 14', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsBackFrom14.ps1'), done);
        })
        it('(Select-VSVersion) falls forward from 12', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsForwardFrom12.ps1'), done);
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
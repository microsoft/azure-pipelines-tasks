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
        it('(Select-MSBuildLocation) maps vs versions', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.MapsVSVersions.ps1'), done);
        })
        it('(Select-MSBuildLocation) throws if ms build version not found', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.ThrowsIfMSBuildVersionNotFound.ps1'), done);
        })
        it('(Select-MSBuildLocation) throws if unknown vs version', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.ThrowsIfUnknownVSVersion.ps1'), done);
        })
        it('(Select-VSVersion) falls back to latest', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FallsBackToLatest.ps1'), done);
        })
        it('(Select-VSVersion) finds latest', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FindsLatest.ps1'), done);
        })
        it('(Select-VSVersion) finds preferred', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.FindsPreferred.ps1'), done);
        })
        it('(Select-VSVersion) warns if vs not found', (done) => {
            psr.run(path.join(__dirname, 'Select-VSVersion.WarnsIfVSNotFound.ps1'), done);
        })
        it('passes arguments', (done) => {
            psr.run(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
        it('warns if deprecated input specified', (done) => {
            psr.run(path.join(__dirname, 'WarnsIfDeprecatedInputSpecified.ps1'), done);
        })
    }
});
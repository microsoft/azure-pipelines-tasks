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
console.log(ps);
describe('VSBuild Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('(Select-MSBuildLocation) maps vs versions', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.MapsVSVersions.ps1'), done);
        })
        it('(Select-MSBuildLocation) throws if ms build version not found', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.ThrowsIfMSBuildVersionNotFound.ps1'), done);
        })
        it('(Select-MSBuildLocation) throws if unknown vs version', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.ThrowsIfUnknownVSVersion.ps1'), done);
        })
        it('(Select-VSVersion) falls back to latest', (done) => {
            psm.runPS(path.join(__dirname, 'Select-VSVersion.FallsBackToLatest.ps1'), done);
        })
        it('(Select-VSVersion) finds latest', (done) => {
            psm.runPS(path.join(__dirname, 'Select-VSVersion.FindsLatest.ps1'), done);
        })
        it('(Select-VSVersion) finds preferred', (done) => {
            psm.runPS(path.join(__dirname, 'Select-VSVersion.FindsPreferred.ps1'), done);
        })
        it('(Select-VSVersion) warns if vs not found', (done) => {
            psm.runPS(path.join(__dirname, 'Select-VSVersion.WarnsIfVSNotFound.ps1'), done);
        })
        it('passes arguments', (done) => {
            psm.runPS(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
        it('warns if deprecated input specified', (done) => {
            psm.runPS(path.join(__dirname, 'WarnsIfDeprecatedInputSpecified.ps1'), done);
        })
    }
});
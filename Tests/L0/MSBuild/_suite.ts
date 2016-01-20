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

describe('MSBuild Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('(Select-MSBuildLocation) defaults method to location if location specified', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.DefaultsMethodToLocationIfLocationSpecified.ps1'), done);
        })
        it('(Select-MSBuildLocation) defaults method to version if no location', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.DefaultsMethodToVersionIfNoLocation.ps1'), done);
        })
        it('(Select-MSBuildLocation) returns latest version', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.ReturnsLatestVersion.ps1'), done);
        })
        it('(Select-MSBuildLocation) returns specified location', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.ReturnsSpecifiedLocation.ps1'), done);
        })
        it('(Select-MSBuildLocation) returns specified version', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.ReturnsSpecifiedVersion.ps1'), done);
        })
        it('(Select-MSBuildLocation) reverts to latest version if version not found', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.RevertsToLatestVersionIfVersionNotFound.ps1'), done);
        })
        it('(Select-MSBuildLocation) reverts to version if no location specified', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.RevertsToVersionIfNoLocationSpecified.ps1'), done);
        })
        it('(Select-MSBuildLocation) throws if version not found', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.ThrowsIfVersionNotFound.ps1'), done);
        })
        it('passes arguments', (done) => {
            psm.runPS(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
    }
});
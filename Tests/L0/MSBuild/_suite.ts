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

describe('MSBuild Suite', function () {
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
        it('(Select-MSBuildLocation) defaults method to location if location specified', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.DefaultsMethodToLocationIfLocationSpecified.ps1'), done);
        })
        it('(Select-MSBuildLocation) defaults method to version if no location', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.DefaultsMethodToVersionIfNoLocation.ps1'), done);
        })
        it('(Select-MSBuildLocation) returns latest version', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.ReturnsLatestVersion.ps1'), done);
        })
        it('(Select-MSBuildLocation) returns specified location', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.ReturnsSpecifiedLocation.ps1'), done);
        })
        it('(Select-MSBuildLocation) returns specified version', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.ReturnsSpecifiedVersion.ps1'), done);
        })
        it('(Select-MSBuildLocation) reverts to latest version if version not found', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.RevertsToLatestVersionIfVersionNotFound.ps1'), done);
        })
        it('(Select-MSBuildLocation) reverts to version if no location specified', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.RevertsToVersionIfNoLocationSpecified.ps1'), done);
        })
        it('(Select-MSBuildLocation) throws if version not found', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildLocation.ThrowsIfVersionNotFound.ps1'), done);
        })
        it('passes arguments', (done) => {
            psr.run(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
    }
});
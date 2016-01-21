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

describe('MSBuild-Legacy Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('(Format-MSBuildArguments) adds configuration property', (done) => {
            psm.runPS(path.join(__dirname, 'Format-MSBuildArguments.AddsConfigurationProperty.ps1'), done);
        })
        it('(Format-MSBuildArguments) adds platform property', (done) => {
            psm.runPS(path.join(__dirname, 'Format-MSBuildArguments.AddsPlatformProperty.ps1'), done);
        })
        it('(Get-SolutionFiles) resolves wildcards', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SolutionFiles.ResolvesWildcards.ps1'), done);
        })
        it('(Get-SolutionFiles) returns non wildcard solution', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SolutionFiles.ReturnsNonWildcardSolution.ps1'), done);
        })
        it('(Get-SolutionFiles) throws if no solution', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SolutionFiles.ThrowsIfNoSolution.ps1'), done);
        })
        it('(Get-SolutionFiles) throws if no solution found', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SolutionFiles.ThrowsIfNoSolutionFound.ps1'), done);
        })
        it('(Invoke-BuildTools) invokes all tools for all files', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-BuildTools.InvokesAllToolsForAllFiles.ps1'), done);
        })
        it('(Invoke-BuildTools) skips clean if specified', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-BuildTools.SkipsCleanIfSpecified.ps1'), done);
        })
        it('(Invoke-BuildTools) skips restore if nu get not found', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-BuildTools.SkipsRestoreIfNuGetNotFound.ps1'), done);
        })
        it('(Invoke-BuildTools) skips restore if specified', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-BuildTools.SkipsRestoreIfSpecified.ps1'), done);
        })
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
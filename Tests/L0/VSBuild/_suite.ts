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
    this.timeout(10000);

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
        it('(Format-MSBuildArguments) adds VS version property', (done) => {
            psm.runPS(path.join(__dirname, 'Format-MSBuildArguments.AddsVSVersionProperty.ps1'), done);
        })
        it('(Get-SolutionFiles) resolves wildcards', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SolutionFiles.ResolvesWildcards.ps1'), done);
        })
        it('(Get-SolutionFiles) returns non-wildcard solution', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SolutionFiles.ReturnsNonWildcardSolution.ps1'), done);
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
        it('(Invoke-BuildTools) skips restore if specified', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-BuildTools.SkipsRestoreIfSpecified.ps1'), done);
        })
        it('(Invoke-BuildTools) skips restore if NuGet not found', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-BuildTools.SkipsRestoreIfNuGetNotFound.ps1'), done);
        })
        it('(Select-MSBuildLocation) maps VS versions', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.MapsVSVersions.ps1'), done);
        })
        it('(Select-MSBuildLocation) throws if MSBuild version not found', (done) => {
            psm.runPS(path.join(__dirname, 'Select-MSBuildLocation.ThrowsIfMSBuildVersionNotFound.ps1'), done);
        })
        it('(Select-MSBuildLocation) throws if unknown VS version', (done) => {
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
        it('(Select-VSVersion) warns if VS not found', (done) => {
            psm.runPS(path.join(__dirname, 'Select-VSVersion.WarnsIfVSNotFound.ps1'), done);
        })
        it('passes arguments', (done) => {
            psm.runPS(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
        it('throws if no solution', (done) => {
            psm.runPS(path.join(__dirname, 'ThrowsIfNoSolution.ps1'), done);
        })
        it('warns if MSBuild location specified', (done) => {
            psm.runPS(path.join(__dirname, 'WarnsIfMSBuildLocationSpecified.ps1'), done);
        })
        it('warns if MSBuild version specified', (done) => {
            psm.runPS(path.join(__dirname, 'WarnsIfMSBuildVersionSpecified.ps1'), done);
        })
        it('warns if VS location specified', (done) => {
            psm.runPS(path.join(__dirname, 'WarnsIfVSLocationSpecified.ps1'), done);
        })
    }
});
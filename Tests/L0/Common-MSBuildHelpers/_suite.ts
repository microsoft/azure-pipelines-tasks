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

describe('Common-MSBuildHelpers Suite', function () {
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
        it('(ConvertFrom-SerializedLoggingCommand) ignores malformed commands', (done) => {
            psr.run(path.join(__dirname, 'ConvertFrom-SerializedLoggingCommand.IgnoresMalformedCommands.ps1'), done);
        })
        it('(ConvertFrom-SerializedLoggingCommand) parses into objects', (done) => {
            psr.run(path.join(__dirname, 'ConvertFrom-SerializedLoggingCommand.ParsesIntoObjects.ps1'), done);
        })
        it('(Format-MSBuildArguments) adds configuration property', (done) => {
            psr.run(path.join(__dirname, 'Format-MSBuildArguments.AddsConfigurationProperty.ps1'), done);
        })
        it('(Format-MSBuildArguments) adds platform property', (done) => {
            psr.run(path.join(__dirname, 'Format-MSBuildArguments.AddsPlatformProperty.ps1'), done);
        })
        it('(Format-MSBuildArguments) adds VS version property', (done) => {
            psr.run(path.join(__dirname, 'Format-MSBuildArguments.AddsVSVersionProperty.ps1'), done);
        })
        it('(Get-SolutionFiles) resolves wildcards', (done) => {
            psr.run(path.join(__dirname, 'Get-SolutionFiles.ResolvesWildcards.ps1'), done);
        })
        it('(Get-SolutionFiles) returns non wildcard solution', (done) => {
            psr.run(path.join(__dirname, 'Get-SolutionFiles.ReturnsNonWildcardSolution.ps1'), done);
        })
        it('(Get-SolutionFiles) throws if no solution', (done) => {
            psr.run(path.join(__dirname, 'Get-SolutionFiles.ThrowsIfNoSolution.ps1'), done);
        })
        it('(Get-SolutionFiles) throws if no solution found', (done) => {
            psr.run(path.join(__dirname, 'Get-SolutionFiles.ThrowsIfNoSolutionFound.ps1'), done);
        })
        it('(Invoke-BuildTools) invokes all tools for all files', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.InvokesAllToolsForAllFiles.ps1'), done);
        })
        it('(Invoke-BuildTools) skips clean if specified', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.SkipsCleanIfSpecified.ps1'), done);
        })
        it('(Invoke-BuildTools) skips restore if specified', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.SkipsRestoreIfSpecified.ps1'), done);
        })
        it('(Invoke-MSBuild) combines msbuildexe', (done) => {
            psr.run(path.join(__dirname, 'Invoke-MSBuild.CombinesMsbuildexe.ps1'), done);
        })
    }
});
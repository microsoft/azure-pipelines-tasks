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

describe('VsTest Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('(VsTest-NoTestAssemblies) throws if no test assemblies provided as input', (done) => {
            psm.runPS(path.join(__dirname, 'ThrowsIfAssembliesNotProvided.ps1'), done);
        })
        it('(VsTest-NoSourceDiretory) throws if no source directory is found', (done) => {
            psm.runPS(path.join(__dirname, 'ThrowsIfNoSourceDirectoryFound.ps1'), done);
        })
        it('(2015U1Check.ReturnsTrueIfTaefFileIsFound) returns true if taef file is found', (done) => {
            psm.runPS(path.join(__dirname, '2015U1Check.ReturnsTrueIfTaefFileIsFound.ps1'), done);
        })
        it('(2015U1Check.ReturnsFalseForOlderVSTestVersion.ps1) returns false if vstest version less than 14', (done) => {
            psm.runPS(path.join(__dirname, '2015U1Check.ReturnsFalseForOlderVSTestVersion.ps1'), done);
        })
        it('(2015U1Check.ReturnsTrueForLaterVSTestVersion) returns true if vstest version greater than 14', (done) => {
            psm.runPS(path.join(__dirname, '2015U1Check.ReturnsTrueForLaterVSTestVersion.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsSameFileIfParallelIsFalse) returns same file if parallel flag is false', (done) => {
            psm.runPS(path.join(__dirname, 'RunSettingsForParallel.ReturnsSameFileIfParallelIsFalse.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameEmpty) returns new file if parallel flag is true and no runsettings file is provided', (done) => {
            psm.runPS(path.join(__dirname, 'RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameEmpty.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameNotEmpty) returns same but updated file if parallel flag is true and a runsettings file is provided', (done) => {
            psm.runPS(path.join(__dirname, 'RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameNotEmpty.ps1'), done);
        })
        it('(NoResultsFile.PrintsWarning) prints a warning if no results file is found', (done) => {
            psm.runPS(path.join(__dirname, 'NoResultsFile.PrintsWarning.ps1'), done);
        })
        it('(NoTestAssemblies.PrintsWarning) prints a warning if no test assemblies are found', (done) => {
            psm.runPS(path.join(__dirname, 'NoTestAssemblies.PrintsWarning.ps1'), done);
        })
        it('(Compat.OptOutOfPublishNotInCmdlet.ProvidedByTask) does not throw if publishattachments is not found in the cmdlet', (done) => {
            psm.runPS(path.join(__dirname, 'Compat.OptOutOfPublishNotInCmdlet.ProvidedByTask.ps1'), done);
        })
        it('(Compat.TestRunTitleNotInCmdlet.ProvidedByTask) does not throw if testrun title is not found in the cmdlet', (done) => {
            psm.runPS(path.join(__dirname, 'Compat.TestRunTitleNotInCmdlet.ProvidedByTask.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsADirectory) returns new file if parallel flag is true and runsettings input is a directory', (done) => {
            psm.runPS(path.join(__dirname, 'RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsADirectory.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsANonRunsettingsFile) returns new file if parallel flag is true and runsettings input is not a runsettings file', (done) => {
            psm.runPS(path.join(__dirname, 'RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsANonRunsettingsFile.ps1'), done);
        })
        it('ValidateTestAssembliesAreSplit) tests if the input test assembiles are properly passed to cmdlet', (done) => {
            psm.runPS(path.join(__dirname, 'ValidateTestAssembliesAreSplit.ps1'), done);
        })
         it('ValidateTestAssembliesAreSplit) tests if the input test assembiles are properly passed to cmdlet', (done) => {
            psm.runPS(path.join(__dirname, 'ValidateTestAssembliesAreNotSplit.ps1'), done);
        })
    }
});
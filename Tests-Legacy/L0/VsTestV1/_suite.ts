import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
import os = require('os');
import mockHelper = require('../../lib/mockHelper');
import fs = require('fs');
import shell = require('shelljs');
import uuid = require('node-uuid');
var ps = shell.which('powershell.exe');
var psr = null;
const tmpFileName = path.join(os.tmpdir(), uuid.v1() + ".json");
const testDllPath = path.join(__dirname, "data", "testDlls");
const sysVstestLocation = "\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe";

function setResponseFile(name: string, vstestCmd?: string, isPass?: boolean) {
    let fileName = path.join(__dirname, name);
    if (typeof vstestCmd !== "undefined") {
        if (typeof isPass === "undefined") {
            isPass = true;
        }
        let fileContent: string = fs.readFileSync(fileName, 'utf8');
        let fileJson = JSON.parse(fileContent);
        let errCode: number = isPass ? 0 : 1;
        let stdErr: string = isPass ? "" : "Error string";

        fileJson.exec[vstestCmd] = { "code": errCode, "stdout": "vstest", "stderr": stdErr };
        fs.writeFileSync(tmpFileName, JSON.stringify(fileJson));
        fileName = tmpFileName;
    }
    process.env['MOCK_RESPONSES'] = fileName;
}

function posixFormat(p: string): string {
    let path_regex = /\/\//;
    p = p.replace(/\\/g, '/');
    while (p.match(path_regex)) {
        p = p.replace(path_regex, '/');
    }
    return p;
}

function getTestDllString(testDlls: string[]): string {
    let dllString: string = "";
    testDlls.forEach(function (part, index) {
        testDlls[index] = posixFormat(path.join(testDllPath, testDlls[index]));
    });
    return testDlls.join(" ");
}

describe('VsTest Suite', function () {
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
        fs.unlink(tmpFileName, function (err) {
            if (err) {
                console.log("Error encountered deleting temp file: " + err);
            }
        });
    });

    if (ps) {
        it('(VsTest-NoTestAssemblies) throws if no test assemblies provided as input', (done) => {
            psr.run(path.join(__dirname, 'ThrowsIfAssembliesNotProvided.ps1'), done);
        })
        it('(VsTest-NoSourceDirectory) throws if no source directory is found', (done) => {
            psr.run(path.join(__dirname, 'ThrowsIfNoSourceDirectoryFound.ps1'), done);
        })
        it('(2015U1Check.ReturnsTrueIfTaefFileIsFound) returns true if taef file is found', (done) => {
            psr.run(path.join(__dirname, '2015U1Check.ReturnsTrueIfTaefFileIsFound.ps1'), done);
        })
        it('(2015U1Check.ReturnsFalseForOlderVSTestVersion.ps1) returns false if vstest version less than 14', (done) => {
            psr.run(path.join(__dirname, '2015U1Check.ReturnsFalseForOlderVSTestVersion.ps1'), done);
        })
        it('(2015U1Check.ReturnsTrueForLaterVSTestVersion) returns true if vstest version greater than 14', (done) => {
            psr.run(path.join(__dirname, '2015U1Check.ReturnsTrueForLaterVSTestVersion.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsSameFileIfParallelIsFalse) returns same file if parallel flag is false', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsSameFileIfParallelIsFalse.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameEmpty) returns new file if parallel flag is true and no runsettings file is provided', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameEmpty.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameNotEmpty) returns same but updated file if parallel flag is true and a runsettings file is provided', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameNotEmpty.ps1'), done);
        })
        it('(NoResultsFile.PrintsWarning) prints a warning if no results file is found', (done) => {
            psr.run(path.join(__dirname, 'NoResultsFile.PrintsWarning.ps1'), done);
        })
        it('(NoTestAssemblies.PrintsWarning) prints a warning if no test assemblies are found', (done) => {
            psr.run(path.join(__dirname, 'NoTestAssemblies.PrintsWarning.ps1'), done);
        })
        it('(Compat.OptOutOfPublishNotInCmdlet.ProvidedByTask) does not throw if publishattachments is not found in the cmdlet', (done) => {
            psr.run(path.join(__dirname, 'Compat.OptOutOfPublishNotInCmdlet.ProvidedByTask.ps1'), done);
        })
        it('(Compat.TestRunTitleNotInCmdlet.ProvidedByTask) does not throw if testrun title is not found in the cmdlet', (done) => {
            psr.run(path.join(__dirname, 'Compat.TestRunTitleNotInCmdlet.ProvidedByTask.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsADirectory) returns new file if parallel flag is true and runsettings input is a directory', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsADirectory.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsANonRunsettingsNonTestSettingsFile) returns new file if parallel flag is true and runsettings input is not a runsettings or testsettings file', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsANonRunsettingsNonTestSettingsFile.ps1'), done);
        })
        it('ValidateTestAssembliesAreSplit) tests if the input test assembiles are properly passed to cmdlet', (done) => {
            psr.run(path.join(__dirname, 'ValidateTestAssembliesAreSplit.ps1'), done);
        })
        it('ValidateTestAssembliesAreSplit) tests if the input test assembiles are properly passed to cmdlet', (done) => {
            psr.run(path.join(__dirname, 'ValidateTestAssembliesAreNotSplit.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameIsTestSettingsFile) returns same file if parallel flag is true and runsettings input is a testsettings file', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameIsTestSettingsFile.ps1'), done);
        })

        it('(GetResultsLocationReturnsPathFromRunsettings) returns the custom results location from runsettings', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsPathFromRunsettings.ps1'), done);
        })

        it('(GetResultsLocationReturnsPathFromRunsettingsForRelativePaths) returns the custom results location from runsettings for relative paths', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsPathFromRunsettingsForRelativePaths.ps1'), done);
        })

        it('(GetResultsLocationReturnsNullForRunsettingsWithoutResultsDirectory) returns null if there is no results location in runsettings', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsNullForRunsettingsWithoutResultsDirectory.ps1'), done);
        })

        it('(GetResultsLocationReturnsPathForTmpFile) returns the custom results location for tmp file extension', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsPathForTmpFile.ps1'), done);
        })

        it('(GetResultsReturnsNullForTestsettings) returns null for any other file type', (done) => {
            psr.run(path.join(__dirname, 'GetResultsReturnsNullForTestsettings.ps1'), done);
        })

        it('(GetResultsLocationReturnsNullForDirectory) returns the null for directory specified as runsettings', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsNullForDirectory.ps1'), done);
        })

        it('(GetResultsLocationReturnsNullForEmptyPath) returns null for empty directory specified as runsettings', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsNullForEmptyPath.ps1'), done);
        })

        it('(TestResultsDirectoryVariableIsUsedIfnorunsettings) vstest invoked with  default test results directory if no settings is specified', (done) => {
            psr.run(path.join(__dirname, 'TestResultsDirectoryVariableIsUsedIfnorunsettings.ps1'), done);
        })

        it('(TestResultsDirectoryVariableIsUsedIfOverrideParamsAreUsed) vstest invoked with  default test results directory if override run parameters is used', (done) => {
            psr.run(path.join(__dirname, 'TestResultsDirectoryVariableIsUsedIfOverrideParamsAreUsed.ps1'), done);
        })

        it('Latest option chosen with VS 15 Willow installed', (done) => {
            psr.run(path.join(__dirname, 'LatestSelectedwithVS15Installed.ps1'), done);
        })

        it('v14 option chosen with VS 15 Willow installed', (done) => {
            psr.run(path.join(__dirname, 'V14SelectedwithVS15Installed.ps1'), done);
        })
    }

    if (!os.type().match(/^Win/)) {
        console.log("Skipping vstest tests. Vstest tests run only on windows.")
        return;
    }
});
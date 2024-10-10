import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

describe('Common-MSBuildHelpers Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 30000);

    before((done) => {
        if (psm.testSupported()) {
            psr = new psm.PSRunner();
            psr.start();
        }

        done();
    });

    after(function () {
        if (psr) {
            psr.kill();
        }
    });

    if (psm.testSupported()) {
        it('(Format-MSBuildArguments) adds configuration property', (done) => {
            psr.run(path.join(__dirname, 'Format-MSBuildArguments.AddsConfigurationProperty.ps1'), done);
        })
        it('(Format-MSBuildArguments) adds maximum CPU count', (done) => {
            psr.run(path.join(__dirname, 'Format-MSBuildArguments.AddsMaximumCpuCount.ps1'), done);
        })
        it('(Format-MSBuildArguments) adds MS deploy user agent property', (done) => {
            psr.run(path.join(__dirname, 'Format-MSBuildArguments.AddsMSDeployUserAgentProperty.ps1'), done);
        })
        it('(Format-MSBuildArguments) adds platform property', (done) => {
            psr.run(path.join(__dirname, 'Format-MSBuildArguments.AddsPlatformProperty.ps1'), done);
        })
        it('(Format-MSBuildArguments) adds VS version property', (done) => {
            psr.run(path.join(__dirname, 'Format-MSBuildArguments.AddsVSVersionProperty.ps1'), done);
        })
        it('(Format-MSBuildArguments) rejects invalid characters', (done) => {
            psr.run(path.join(__dirname, 'Format-MSBuildArguments.RejectsInvalidCharacters.ps1'), done);
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
        it('(Get-VisualStudio 15 caches not found result', (done) => {
            psr.run(path.join(__dirname, 'Get-VisualStudio_15_0.CachesNotFoundResult.ps1'), done);
        })
        it('(Get-VisualStudio 15) caches result', (done) => {
            psr.run(path.join(__dirname, 'Get-VisualStudio_15_0.CachesResult.ps1'), done);
        })
        it('(Get-VisualStudio 15) falls back to build tools', (done) => {
            psr.run(path.join(__dirname, 'Get-VisualStudio_15_0.FallsBackToBuildTools.ps1'), done);
        })
        it('(Get-VisualStudio 15) ignores STDERR', (done) => {
            psr.run(path.join(__dirname, 'Get-VisualStudio_15_0.IgnoresStderr.ps1'), done);
        })
        it('(Get-VisualStudio 16) caches not found result', (done) => {
            psr.run(path.join(__dirname, 'Get-VisualStudio_16_0.CachesNotFoundResult.ps1'), done);
        })
        it('(Get-VisualStudio 16) caches result', (done) => {
            psr.run(path.join(__dirname, 'Get-VisualStudio_16_0.CachesResult.ps1'), done);
        })
        it('(Get-VisualStudio 16) falls back to build tools', (done) => {
            psr.run(path.join(__dirname, 'Get-VisualStudio_16_0.FallsBackToBuildTools.ps1'), done);
        })
        it('(Get-VisualStudio 16) ignores STDERR', (done) => {
            psr.run(path.join(__dirname, 'Get-VisualStudio_16_0.IgnoresStderr.ps1'), done);
        })        
        it('(Invoke-BuildTools) invokes all tools for all files', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.InvokesAllToolsForAllFiles.ps1'), done);
        })
        it('(Invoke-BuildTools) skips clean if specified', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.SkipsCleanIfSpecified.ps1'), done);
        })
        it('(Invoke-BuildTools) skips create log file if specified', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.SkipsCreateLogFileIfSpecified.ps1'), done);
        })
        it('(Invoke-BuildTools) skips restore if specified', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.SkipsRestoreIfSpecified.ps1'), done);
        })
        it('(Invoke-BuildTools) skips second build if clean plus targets provided', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.SkipsSecondBuildIfCleanPlusTargetsProvided.ps1'), done);
        })
        it('(Invoke-BuildTools) default logger is enabled by default', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.DefaultLoggerEnabledByDefault.ps1'), done);
        })
        it('(Invoke-BuildTools) disables default logger', (done) => {
            psr.run(path.join(__dirname, 'Invoke-BuildTools.DisableDefaultLogger.ps1'), done);
        })
        it('(Invoke-MSBuild) combines msbuildexe', (done) => {
            psr.run(path.join(__dirname, 'Invoke-MSBuild.CombinesMsbuildexe.ps1'), done);
        })
        it('(Invoke-MSBuild) fails root timeline detail on exit code', (done) => {
            psr.run(path.join(__dirname, 'Invoke-MSBuild.FailsRootTimelineDetailOnExitCode.ps1'), done);
        })
        it('(Invoke-MSBuild) omits timeline detail', (done) => {
            psr.run(path.join(__dirname, 'Invoke-MSBuild.OmitsTimelineDetail.ps1'), done);
        })
        it('(Invoke-MSBuild) skips log file upload if missing', (done) => {
            psr.run(path.join(__dirname, 'Invoke-MSBuild.SkipsLogUploadIfMissing.ps1'), done);
        })
        it('(Invoke-MSBuild) writes root timeline detail', (done) => {
            psr.run(path.join(__dirname, 'Invoke-MSBuild.WritesRootTimelineDetail.ps1'), done);
        })
        it('(Select-MSBuildPath) defaults method to location if location specified', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.DefaultsMethodToLocationIfLocationSpecified.ps1'), done);
        })
        it('(Select-MSBuildPath) defaults method to version if no location', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.DefaultsMethodToVersionIfNoLocation.ps1'), done);
        })
        it('(Select-MSBuildPath) errors if version not found', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.ErrorsIfVersionNotFound.ps1'), done);
        })
        it('(Select-MSBuildPath) falls back from 14', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.FallsBackFrom14.ps1'), done);
        })
        it('(Select-MSBuildPath) falls back from 15', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.FallsBackFrom15.ps1'), done);
        })
        it('(Select-MSBuildPath) falls back to version if no location specified', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.FallsBackToVersionIfNoLocationSpecified.ps1'), done);
        })
        it('(Select-MSBuildPath) falls forward from 12', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.FallsForwardFrom12.ps1'), done);
        })
        it('(Select-MSBuildPath) falls forward from 14', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.FallsForwardFrom14.ps1'), done);
        })
        it('(Select-MSBuildPath) returns latest version', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.ReturnsLatestVersion.ps1'), done);
        })
        it('(Select-MSBuildPath) returns specified location', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.ReturnsSpecifiedLocation.ps1'), done);
        })
        it('(Select-MSBuildPath) returns specified version', (done) => {
            psr.run(path.join(__dirname, 'Select-MSBuildPath.ReturnsSpecifiedVersion.ps1'), done);
        })
    }
});
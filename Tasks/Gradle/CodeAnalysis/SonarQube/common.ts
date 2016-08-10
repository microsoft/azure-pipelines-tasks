/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import path = require('path');
import fs = require('fs');

import {ToolRunner} from 'vsts-task-lib/toolrunner';

import tl = require('vsts-task-lib/task');
import {TaskResult} from 'vsts-task-lib/task';

import {SonarQubeEndpoint} from './endpoint';
import {SonarQubeRunSettings} from './runsettings';
import {ISonarQubeServer, SonarQubeServer} from './server';
import {SonarQubeMetrics} from './metrics';
import {SonarQubeReportBuilder} from './reportbuilder';
import {SonarQubeParameterHelper} from './parameter-helper';

export const toolName: string = 'SonarQube';

// Returns true if SonarQube integration is enabled.
export function isSonarQubeAnalysisEnabled(): boolean {
    return tl.getBoolInput('sqAnalysisEnabled', false);
}

/**
 * Apply all parameters necessary for SonarQube operation to the given ToolRunner.
 * @param toolRunner
 * @returns {ToolRunner}
 */
export function applySonarQubeParameters(toolRunner: ToolRunner): ToolRunner {
    return SonarQubeParameterHelper.applySonarQubeParameters(toolRunner);
}

// Upload a build summary with links to available SonarQube dashboards for further analysis details.
/**
 * Act on all user-enabled SonarQube integration options: build break, build summary, etc.
 * @param sqBuildFolder
 * @returns {Promise<void>} Promise resolved when all SQ integration actions are complete.
 */
export function processSonarQubeIntegration(sqBuildFolder:string):Q.Promise<void> {
    var sqRunSettings:SonarQubeRunSettings = getSonarQubeRunSettings(sqBuildFolder);
    var sqMetrics:SonarQubeMetrics = getSonarQubeMetrics(sqRunSettings);

    // Wait for all promises to complete before proceeding (even if one or more promises reject).
    return Q.allSettled([
        processSonarQubeBuildSummary(sqRunSettings, sqMetrics),
        processSonarQubeBuildBreaker(sqRunSettings, sqMetrics),
    ])
        .then(() => {
        })
}

/**
 * Determine if the current build was triggered by a pull request.
 *
 * Remark: this logic is temporary until the platform provides a more robust way of determining PR builds;
 * Note that PR builds are only supported on TfsGit
 * @returns {boolean} True if the build is a PR build, false otherwise.
 */
export function isPrBuild(): boolean {
    let sourceBranch: string = tl.getVariable('build.sourceBranch');
    let sccProvider: string = tl.getVariable('build.repository.provider');

    tl.debug("Source Branch: " + sourceBranch);
    tl.debug("Scc Provider: " + sccProvider);

    return !isNullOrEmpty(sccProvider) &&
        sccProvider.toLowerCase() === "tfsgit" &&
        !isNullOrEmpty(sourceBranch) &&
        sourceBranch.toLowerCase().startsWith("refs/pull/");
}

/**
 * Returns, as an object, the contents of the report-task.txt file created by SonarQube plugins
 * The returned object contains the following properties:
 *     projectKey, serverUrl, dashboardUrl, ceTaskId, ceTaskUrl
 * @param sonarPluginFolder The folder created by SonarQube integration during build
 * @returns {SonarQubeRunSettings} An object with fields corresponding to the properties exposed in report-task.txt, or null if PR build
 */
function getSonarQubeRunSettings(sonarPluginFolder: string): SonarQubeRunSettings {
    if (isPrBuild()) {
        return null;
    }

    var reportFilePath:string = path.join(sonarPluginFolder, 'report-task.txt');
    return SonarQubeRunSettings.createRunSettingsFromFile(reportFilePath);
}

/**
 * Returns the appropriate SQMetrics object for this build.
 * @param sqRunSettings An object with fields corresponding to the properties exposed in report-task.txt
 * @returns {SonarQubeMetrics} An SQMetrics instance for this build on the SQ server, or null if PR build
 */
function getSonarQubeMetrics(sqRunSettings:SonarQubeRunSettings): SonarQubeMetrics {
    if (isPrBuild()) {
        return null;
    }

    var sqServer:ISonarQubeServer = new SonarQubeServer(SonarQubeEndpoint.createSonarQubeEndpoint());
    return new SonarQubeMetrics(sqServer, sqRunSettings.ceTaskId);
}

function isNullOrEmpty(str) {
    return str === undefined || str === null || str.length === 0;
}

/**
 * Handle checking the status of the quality gate and failing the build if the quality gate has failed.
 * No action is taken if the feature is not enabled, or sqRunSettings argument is null.
 * @param sqRunSettings SonarQubeRunSettings object for this build or null if this is a PR build and the object could not be created
 * @param sqMetrics     SonarQube metrics for the applicable run
 * @returns {Q.Promise<void>} Promise resolved when action completes.
 */
function processSonarQubeBuildBreaker(sqRunSettings:SonarQubeRunSettings, sqMetrics:SonarQubeMetrics):Q.Promise<void> {
    if (!tl.getBoolInput('sqAnalysisBreakBuildIfQualityGateFailed')) {
        return Q.when<void>(null);
    }

    return breakBuildIfQualityGateFails(sqRunSettings, sqMetrics);
}

export /* public for test */ function breakBuildIfQualityGateFails(sqRunSettings:SonarQubeRunSettings, sqMetrics:SonarQubeMetrics):Q.Promise<void> {
    // During a pull request build, data necessary to create SQRunSettings is not available
    if (sqRunSettings == null || isPrBuild()) {
        console.log(tl.loc('sqAnalysis_IsPullRequest_SkippingBuildBreaker'));
        return Q.when<void>(null);
    }

    // Necessary data is not available during a pull request build
    return sqMetrics.getTaskResultFromQualityGateStatus()
        .then((taskResult:TaskResult) => {
            if (taskResult == TaskResult.Failed) {
// Looks like: "The SonarQube quality gate associated with this build has failed. For more details see http://mysonarqubeserver"
                tl.setResult(1, tl.loc('sqAnalysis_BuildBrokenDueToQualityGateFailure', sqRunSettings.dashboardUrl));
                return;
            }

            // Looks like: "The SonarQube quality gate associated with this build has passed (status OK)"
            console.log(tl.loc('sqAnalysis_QualityGatePassed', sqMetrics.getQualityGateStatus()));
        });
}

/**
 * Handle the creation, saving and upload of the SonarQube build summary.
 * @param sqRunSettings SonarQubeRunSettings object for the applicable run or null if this is a PR build and the object could not be created
 * @param sqMetrics     SonarQube metrics for the applicable run
 * @returns {Promise<void>} Promise resolved when action completes.
 */
function processSonarQubeBuildSummary(sqRunSettings:SonarQubeRunSettings, sqMetrics:SonarQubeMetrics):Q.Promise<void> {
    // During a pull request build, data necessary to create SQRunSettings is not available
    if (sqRunSettings == null || isPrBuild()) {
        console.log(tl.loc('sqAnalysis_IsPullRequest_SkippingBuildSummary'));
        return Q.when<void>(null);
    }

    // Necessary data is not available during a pull request build
    return createSonarQubeBuildSummary(sqRunSettings, sqMetrics)
        .then((buildSummaryContents:string) => {
            return saveSonarQubeBuildSummary(buildSummaryContents);
        })
        .then((buildSummaryFilePath:string) => {
            return uploadBuildSummary(buildSummaryFilePath, tl.loc('sqAnalysis_BuildSummaryTitle'));
        });
}

/**
 * Creates the string that comprises the build summary text.
 * @param sqRunSettings SonarQubeRunSettings object for the applicable run
 * @param sqMetrics     SonarQube metrics for the applicable run
 * @returns {any} Build summary string
 */
function createSonarQubeBuildSummary(sqRunSettings:SonarQubeRunSettings, sqMetrics:SonarQubeMetrics):Q.Promise<string> {
    var sqReportBuilder:SonarQubeReportBuilder = new SonarQubeReportBuilder(sqRunSettings, sqMetrics);
    return sqReportBuilder.fetchMetricsAndCreateReport(tl.getBoolInput('sqAnalysisIncludeFullReport'));
}

/**
 * Saves the build summary string to disk and returns the file path it was saved to.
 * @param contents   The build summary
 * @returns {string} Full path to the build summary file
 */
function saveSonarQubeBuildSummary(contents: string): string {
    var filePath:string = path.join(getOrCreateSonarQubeStagingDirectory(), 'SonarQubeBuildSummary.md');
    fs.writeFileSync(filePath, contents);
    return filePath;
}

/**
 * Issues the upload command for a build summary saved as a file, titled as given.
 * @param buildSummaryFilePath Physical location of the build summary file on disk
 * @param title    Title to be given to the build summary, shown to the user
 */
function uploadBuildSummary(buildSummaryFilePath:string, title:string):void {
    tl.debug('Uploading build summary from ' + buildSummaryFilePath);

    tl.command('task.addattachment', {
        'type': 'Distributedtask.Core.Summary',
        'name': title
    }, buildSummaryFilePath);
}

/**
 * Returns the location of the SonarQube integration staging directory.
 * @returns {string} Full path to the SonarQube staging directory
 */
function getOrCreateSonarQubeStagingDirectory(): string {
    var sqStagingDir = path.join(tl.getVariable('build.artifactStagingDirectory'), ".sqAnalysis");
    tl.mkdirP(sqStagingDir);
    return sqStagingDir;
}
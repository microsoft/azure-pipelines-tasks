/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import path = require('path');
import fs = require('fs');

import tl = require('vsts-task-lib/task');
import {TaskResult} from 'vsts-task-lib/task';

import {SonarQubeEndpoint} from './endpoint';
import {SonarQubeRunSettings} from './run-settings';
import {SonarQubeReportBuilder} from './report-builder';
import {SonarQubeMetrics} from './metrics';

/**
 * Class provides functions for effecting change on the VSTS serverside.
 */
export class VstsServerUtils {

    /**
     * Determine if the current build was triggered by a pull request.
     *
     * Remark: this logic is temporary until the platform provides a more robust way of determining PR builds;
     * Note that PR builds are only supported on TfsGit
     * @returns {boolean} True if the build is a PR build, false otherwise.
     */
    public static isPrBuild(): boolean {
        let sourceBranch: string = tl.getVariable('build.sourceBranch');
        let sccProvider: string = tl.getVariable('build.repository.provider');

        tl.debug("Source Branch: " + sourceBranch);
        tl.debug("Scc Provider: " + sccProvider);

        return !VstsServerUtils.isNullOrEmpty(sccProvider) &&
            sccProvider.toLowerCase() === "tfsgit" &&
            !VstsServerUtils.isNullOrEmpty(sourceBranch) &&
            sourceBranch.toLowerCase().startsWith("refs/pull/");
    }

    /**
     * Handle checking the status of the quality gate and failing the build if the quality gate has failed.
     * No action is taken if the feature is not enabled, or sqRunSettings argument is null.
     * @param sqRunSettings SonarQubeRunSettings object for this build or null if this is a PR build and the object could not be created
     * @param sqMetrics     SonarQube metrics for the applicable run
     * @returns {Q.Promise<void>} Promise resolved when action completes.
     */
    public static processSonarQubeBuildBreaker(sqRunSettings:SonarQubeRunSettings, sqMetrics:SonarQubeMetrics):Q.Promise<void> {
        if (!tl.getBoolInput('sqAnalysisBreakBuildIfQualityGateFailed')) {
            return Q.when<void>(null);
        }

        return VstsServerUtils.breakBuildIfQualityGateFails(sqRunSettings, sqMetrics);
    }

    /**
     * Handle the creation, saving and upload of the SonarQube build summary.
     * @param sqRunSettings SonarQubeRunSettings object for the applicable run or null if this is a PR build and the object could not be created
     * @param sqMetrics     SonarQube metrics for the applicable run
     * @returns {Promise<void>} Promise resolved when action completes.
     */
    public static processSonarQubeBuildSummary(sqRunSettings:SonarQubeRunSettings, sqMetrics:SonarQubeMetrics):Q.Promise<void> {
    // During a pull request build, data necessary to create SQRunSettings is not available
    if (sqRunSettings == null || VstsServerUtils.isPrBuild()) {
        console.log(tl.loc('sqAnalysis_IsPullRequest_SkippingBuildSummary'));
        return Q.when<void>(null);
    }

    // Necessary data is not available during a pull request build
    return VstsServerUtils.createSonarQubeBuildSummary(sqRunSettings, sqMetrics)
            .then((buildSummaryContents:string) => {
                return VstsServerUtils.saveSonarQubeBuildSummary(buildSummaryContents);
            })
            .then((buildSummaryFilePath:string) => {
                return VstsServerUtils.uploadBuildSummary(buildSummaryFilePath, tl.loc('sqAnalysis_BuildSummaryTitle'));
            });
    }

    /**
     * If enabled, fails the build in response to a quality gate failure.
     * @param sqRunSettings SonarQubeRunSettings object for the applicable run or null if this is a PR build and the object could not be created
     * @param sqMetrics     SonarQube metrics for the applicable run
     * @returns {Promise<void>} Promise resolved when action completes (NB: Setting build result to failed results in procees exit)
     */
    private static breakBuildIfQualityGateFails(sqRunSettings:SonarQubeRunSettings, sqMetrics:SonarQubeMetrics):Q.Promise<void> {
        // During a pull request build, data necessary to create SQRunSettings is not available
        if (sqRunSettings == null || VstsServerUtils.isPrBuild()) {
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
     * Creates the string that comprises the build summary text.
     * @param sqRunSettings SonarQubeRunSettings object for the applicable run
     * @param sqMetrics     SonarQube metrics for the applicable run
     * @returns {any} Build summary string
     */
    private static createSonarQubeBuildSummary(sqRunSettings:SonarQubeRunSettings, sqMetrics:SonarQubeMetrics):Q.Promise<string> {
        var sqReportBuilder:SonarQubeReportBuilder = new SonarQubeReportBuilder(sqRunSettings, sqMetrics);
        return sqReportBuilder.fetchMetricsAndCreateReport(tl.getBoolInput('sqAnalysisIncludeFullReport'));
    }

    /**
     * Saves the build summary string to disk and returns the file path it was saved to.
     * @param contents   The build summary
     * @returns {string} Full path to the build summary file
     */
    private static  saveSonarQubeBuildSummary(contents: string): string {
        var filePath:string = path.join(
            VstsServerUtils.getOrCreateSonarQubeStagingDirectory(), 'SonarQubeBuildSummary.md');
        fs.writeFileSync(filePath, contents);
        return filePath;
    }

    /**
     * Issues the upload command for a build summary saved as a file, titled as given.
     * @param buildSummaryFilePath Physical location of the build summary file on disk
     * @param title    Title to be given to the build summary, shown to the user
     */
    private static  uploadBuildSummary(buildSummaryFilePath:string, title:string):void {
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
    private static  getOrCreateSonarQubeStagingDirectory(): string {
        var sqStagingDir = path.join(tl.getVariable('build.artifactStagingDirectory'), ".sqAnalysis");
        tl.mkdirP(sqStagingDir);
        return sqStagingDir;
    }

    /**
     * Utility method, returns true if the given string is undefined, null or has length 0
     * @param str String to examine
     * @returns {boolean}
     */
    private static isNullOrEmpty(str):boolean {
        return str === undefined || str === null || str.length === 0;
    }

}
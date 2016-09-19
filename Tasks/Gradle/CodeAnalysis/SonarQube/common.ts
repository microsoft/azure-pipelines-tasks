/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import path = require('path');
import glob = require('glob');

import {ToolRunner} from 'vsts-task-lib/toolrunner';

import tl = require('vsts-task-lib/task');
import {TaskResult} from 'vsts-task-lib/task';

import {SonarQubeEndpoint} from './endpoint';
import {SonarQubeRunSettings} from './run-settings';
import {ISonarQubeServer, SonarQubeServer} from './server';
import {SonarQubeMetrics} from './metrics';
import {SonarQubeReportBuilder} from './report-builder';
import {SonarQubeParameterHelper} from './parameter-helper';
import {VstsServerUtils} from './vsts-server-utils';

export const toolName: string = 'SonarQube';

/**
 * Returns true if SonarQube integration is enabled.
 * @returns {boolean}
 */
export function isSonarQubeAnalysisEnabled(): boolean {
    return tl.getBoolInput('sqAnalysisEnabled', false);
}

/**
 * Apply all parameters necessary for SonarQube operation to the given ToolRunner.
 * @param toolRunner Master ToolRunner object that will be executed on the command line.
 * @returns {ToolRunner}
 */
export function applySonarQubeParameters(toolRunner: ToolRunner): ToolRunner {
    return SonarQubeParameterHelper.applySonarQubeParameters(toolRunner);
}

/**
 * Act on all user-enabled SonarQube integration options: build break, build summary, etc.
 * @param sqBuildFolder
 * @returns {Promise<void>} Promise resolved when all SQ integration actions are complete.
 */
export function processSonarQubeIntegration(sqTaskReportGlob: string): Q.Promise<void> {

    let sqTaskReportPath: string = findReportTaskFile(sqTaskReportGlob);
    if (sqTaskReportPath === null) {
        return Q.when();
    }

    var sqRunSettings: SonarQubeRunSettings = getSonarQubeRunSettings(sqTaskReportPath);
    var sqMetrics: SonarQubeMetrics = getSonarQubeMetrics(sqRunSettings);

    // Wait for all promises to complete before proceeding (even if one or more promises reject).
    return Q.all([
        VstsServerUtils.processSonarQubeBuildSummary(sqRunSettings, sqMetrics),
    ])
        .then(() => {
            // Apply the build breaker at the end, since breaking the build exits the build process.
            VstsServerUtils.processSonarQubeBuildBreaker(sqRunSettings, sqMetrics);
        });
}

/**
 * Returns, as an object, the contents of the report-task.txt file created by SonarQube plugins
 * The returned object contains the following properties:
 *     projectKey, serverUrl, dashboardUrl, ceTaskId, ceTaskUrl
 * @param sqTaskReportPath Path to the report-task.txt file
 * @returns {SonarQubeRunSettings} An object with fields corresponding to the properties exposed in report-task.txt, or null if PR build
 */
function getSonarQubeRunSettings(sqTaskReportPath: string): SonarQubeRunSettings {
    if (VstsServerUtils.isPrBuild()) {
        return null;
    }

    return SonarQubeRunSettings.createRunSettingsFromFile(sqTaskReportPath);
}

/**
 * Returns the appropriate SQMetrics object for this build.
 * @param sqRunSettings An object with fields corresponding to the properties exposed in report-task.txt
 * @returns {SonarQubeMetrics} An SQMetrics instance for this build on the SQ server, or null if PR build
 */
function getSonarQubeMetrics(sqRunSettings: SonarQubeRunSettings): SonarQubeMetrics {
    if (VstsServerUtils.isPrBuild()) {
        return null;
    }

    var sqServer: ISonarQubeServer = new SonarQubeServer(SonarQubeEndpoint.getTaskSonarQubeEndpoint());
    return new SonarQubeMetrics(sqServer, sqRunSettings.ceTaskId);
}

function findReportTaskFile(reportTaskGlob: string): string {

    // the output folder may not be directly in the build root, for example if the entire project is in a top-lvel dir
    let reportTaskGlobResults: string[] = glob.sync(reportTaskGlob);

    tl.debug(`[SQ] Searching for ${reportTaskGlob} - found ${reportTaskGlobResults.length} file(s)`);

    if (reportTaskGlobResults.length === 0) {
        tl.warning(tl.loc('sqAnalysis_NoReportTask'));
        return null;
    }

    if (reportTaskGlobResults.length > 1) {
        tl.warning(tl.loc('sqAnalysis_MultipleReportTasks'));
    }

    return reportTaskGlobResults[0];
}
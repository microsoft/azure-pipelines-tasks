/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import path = require('path');

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
export function processSonarQubeIntegration(sqBuildFolder:string):Q.Promise<void> {
    var sqRunSettings:SonarQubeRunSettings = getSonarQubeRunSettings(sqBuildFolder);
    var sqMetrics:SonarQubeMetrics = getSonarQubeMetrics(sqRunSettings);

    // Wait for all promises to complete before proceeding (even if one or more promises reject).
    return Q.allSettled([
        VstsServerUtils.processSonarQubeBuildSummary(sqRunSettings, sqMetrics),
    ])
        .then(() => {
            // Apply the build breaker at the end, since breaking the build exits the build process.
            VstsServerUtils.processSonarQubeBuildBreaker(sqRunSettings, sqMetrics);
        })
}

/**
 * Returns, as an object, the contents of the report-task.txt file created by SonarQube plugins
 * The returned object contains the following properties:
 *     projectKey, serverUrl, dashboardUrl, ceTaskId, ceTaskUrl
 * @param sonarPluginFolder The folder created by SonarQube integration during build
 * @returns {SonarQubeRunSettings} An object with fields corresponding to the properties exposed in report-task.txt, or null if PR build
 */
function getSonarQubeRunSettings(sonarPluginFolder: string): SonarQubeRunSettings {
    if (VstsServerUtils.isPrBuild()) {
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
    if (VstsServerUtils.isPrBuild()) {
        return null;
    }

    var sqServer:ISonarQubeServer = new SonarQubeServer(SonarQubeEndpoint.getTaskSonarQubeEndpoint());
    return new SonarQubeMetrics(sqServer, sqRunSettings.ceTaskId);
}
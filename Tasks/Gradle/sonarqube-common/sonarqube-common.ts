/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import path = require('path');
import fs = require('fs');

import {ToolRunner} from 'vsts-task-lib/toolrunner';

import {TaskReport} from './taskreport';
import sqRest = require('./sonarqube-rest');
import sqQualityGate = require('./sonarqube-qualitygate');

import tl = require('../testlib/tasklib-wrapper');

export const toolName: string = 'SonarQube';

// Simple data class for a SonarQube generic endpoint
export class SonarQubeEndpoint {
    constructor(public Url: string, public Username: string, public Password: string) {
    }
}

// Returns true if SonarQube integration is enabled.
export function isSonarQubeAnalysisEnabled(): boolean {
    return tl.getBoolInput('sqAnalysisEnabled', false);
}

// Applies required parameters for connecting a Java-based plugin (Maven, Gradle) to SonarQube.
export function applySonarQubeConnectionParams(toolRunner: ToolRunner): ToolRunner {

    var sqEndpoint: SonarQubeEndpoint = getSonarQubeEndpoint();
    toolRunner.arg('-Dsonar.host.url=' + sqEndpoint.Url);
    toolRunner.arg('-Dsonar.login=' + sqEndpoint.Username);
    toolRunner.arg('-Dsonar.password=' + sqEndpoint.Password);

    // sqDbUrl, sqDbUsername and sqDbPassword are required if the SonarQube version is less than 5.2.
    var sqDbUrl = tl.getInput('sqDbUrl', false);
    var sqDbUsername = tl.getInput('sqDbUsername', false);
    var sqDbPassword = tl.getInput('sqDbPassword', false);

    if (sqDbUrl) {
        toolRunner.arg('-Dsonar.jdbc.url=' + sqDbUrl);
    }
    if (sqDbUsername) {
        toolRunner.arg('-Dsonar.jdbc.username=' + sqDbUsername);
    }
    if (sqDbPassword) {
        toolRunner.arg('-Dsonar.jdbc.password=' + sqDbPassword);
    }

    return toolRunner;
}

// Applies parameters for manually specifying the project name, key and version to SonarQube.
// This will override any user settings.
export function applySonarQubeAnalysisParams(toolRunner: ToolRunner): ToolRunner {
    var projectName:string = tl.getInput('sqProjectName', false);
    var projectKey:string = tl.getInput('sqProjectKey', false);
    var projectVersion:string = tl.getInput('sqProjectVersion', false);

    if (projectName) {
        toolRunner.arg('-Dsonar.projectName=' + projectName);
    }
    if (projectKey) {
        toolRunner.arg('-Dsonar.projectKey=' + projectKey);
    }
    if (projectVersion) {
        toolRunner.arg('-Dsonar.projectVersion=' + projectVersion);
    }

    return toolRunner;
}

// Run SQ analysis in issues mode, but only in PR builds
export function applySonarQubeIssuesModeInPrBuild(toolrunner: ToolRunner) {

    if (isPrBuild()) {
        console.log(tl.loc('sqAnalysis_IncrementalMode'));

        toolrunner.arg("-Dsonar.analysis.mode=issues");
        toolrunner.arg("-Dsonar.report.export.path=sonar-report.json");
    }
    else
    {
        tl.debug("Running a full SonarQube analysis");
    }

    return toolrunner;
}

// Gets SonarQube connection endpoint details.
export function getSonarQubeEndpoint(): SonarQubeEndpoint {
    var errorMessage = "Could not decode the generic endpoint. Please ensure you are running the latest agent (min version 0.3.2)";
    if (!tl.getEndpointUrl) {
        throw new Error(errorMessage);
    }

    var genericEndpoint = tl.getInput("sqConnectedServiceName");
    if (!genericEndpoint) {
        throw new Error(errorMessage);
    }

    var hostUrl = tl.getEndpointUrl(genericEndpoint, false);
    if (!hostUrl) {
        throw new Error(errorMessage);
    }

    // Currently the username and the password are required, but in the future they will not be mandatory
    // - so not validating the values here
    var hostUsername = getSonarQubeAuthParameter(genericEndpoint, 'username');
    var hostPassword = getSonarQubeAuthParameter(genericEndpoint, 'password');

    return new SonarQubeEndpoint(hostUrl, hostUsername, hostPassword);
}

// Upload a build summary with links to available SonarQube dashboards for further analysis details.
export function uploadSonarQubeBuildSummaryIfEnabled(sqBuildFolder:string):Q.Promise<void> {
    return createSonarQubeBuildSummary(sqBuildFolder)
        .then((buildSummaryContents:string) => {
            var buildSummaryFilePath = saveSonarQubeBuildSummary(buildSummaryContents);
            tl.debug('Uploading build summary from ' + buildSummaryFilePath);

            tl.command('task.addattachment', {
                'type': 'Distributedtask.Core.Summary',
                'name': tl.loc('sqAnalysis_BuildSummaryTitle')
            }, buildSummaryFilePath);
        });
}

// Gets a SonarQube authentication parameter from the specified connection endpoint.
// The endpoint stores the auth details as JSON. Unfortunately the structure of the JSON has changed through time, namely the keys were sometimes upper-case.
// To work around this, we can perform case insensitive checks in the property dictionary of the object. Note that the PowerShell implementation does not suffer from this problem.
// See https://github.com/Microsoft/vso-agent/blob/bbabbcab3f96ef0cfdbae5ef8237f9832bef5e9a/src/agent/plugins/release/artifact/jenkinsArtifact.ts for a similar implementation
function getSonarQubeAuthParameter(endpoint, paramName) {

    var paramValue = null;
    var auth = tl.getEndpointAuthorization(endpoint, false);

    if (auth.scheme != "UsernamePassword") {
        throw new Error("The authorization scheme " + auth.scheme + " is not supported for a SonarQube endpoint. Please use a username and a password.");
    }

    var parameters = Object.getOwnPropertyNames(auth['parameters']);

    var keyName;
    parameters.some(function (key) {

        if (key.toLowerCase() === paramName.toLowerCase()) {
            keyName = key;

            return true;
        }
    });

    if (keyName) {
        paramValue = auth['parameters'][keyName];
    }

    return paramValue;
}

// Returns true if this build was triggered in response to a PR
//
// Remark: this logic is temporary until the platform provides a more robust way of determining PR builds; 
// Note that PR builds are only supported on TfsGit
function isPrBuild(): boolean {
    let sourceBranch: string = tl.getVariable('build.sourceBranch');
    let sccProvider: string = tl.getVariable('build.repository.provider');

    tl.debug("Source Branch: " + sourceBranch);
    tl.debug("Scc Provider: " + sccProvider);

    return !isNullOrEmpty(sccProvider) &&
        sccProvider.toLowerCase() === "tfsgit" &&
        !isNullOrEmpty(sourceBranch) &&
        sourceBranch.toLowerCase().startsWith("refs/pull/");
}

function isNullOrEmpty(str) {
    return str === undefined || str === null || str.length === 0;
}

// Creates the string that comprises the build summary text, given the location of the /sonar build folder.
function createSonarQubeBuildSummary(sqBuildFolder:string):Q.Promise<string> {
    // Task report is not created for PR builds - inform the user in the build summary
    if (isPrBuild()) {
        tl.debug('Pull request build, will not attempt to fetch detailed SonarQube report');
        // Looks like: Detailed SonarQube reports are not available for pull request builds.
        return Q.when(tl.loc('sqAnalysis_BuildSummaryNotAvailableInPrBuild'));
    }

    var taskReport:TaskReport = getSonarQubeTaskReport(sqBuildFolder);
    // Build summary has two major sections: quality gate status and a link to the dashboard
    return createQualityGateStatusSection(taskReport)
        .then((qualityGateStatus:string) => {
            // Looks like: "[Detailed SonarQube report >](https://mySQserver:9000/dashboard/index/foo "foo Dashboard")"
            var linkToDashBoard:string = createLinkToSonarQubeDashboard(taskReport);

            // Put the quality gate status and dashboard link sections together with the Markdown newline
            var buildSections:string[] = [qualityGateStatus, linkToDashBoard];
            var buildSummary:string = buildSections.join('  \r\n');
            tl.debug('Build summary:');
            tl.debug(buildSummary);
            return buildSummary;
        })
}

// Returns the location of the SonarQube integration staging directory.
function getOrCreateSonarQubeStagingDirectory(): string {
    var sqStagingDir = path.join(tl.getVariable('build.artifactStagingDirectory'), ".sqAnalysis");
    tl.mkdirP(sqStagingDir);
    return sqStagingDir;
}

// Creates a string containing Markdown of the SonarQube quality gate status for this project.
function createQualityGateStatusSection(taskReport: TaskReport): Q.Promise<string> {
    if (!tl.getBoolInput('sqAnalysisWaitForAnalysis')) {
        // Do not create a quality gate status section if not waiting for the server to analyse the build
        console.log(tl.loc('sqCommon_NotWaitingForAnalysis'));
        return Q.when<string>(null);
    }

    // Wait for analysis to finish so that we can get analysis information from the SonarQube server
    var timeout:number = 300;
    var delay:number = 1;

    console.log(tl.loc('sqCommon_WaitingForAnalysis'));
    return sqRest.waitForAnalysisCompletion(taskReport, timeout, delay)
        .then((analysisCompleted:boolean) => {
            if (!analysisCompleted) {
                tl.debug('Did not receive a success response before the timeout expired.');
                return Q.reject(tl.loc('sqAnalysis_AnalysisTimeout', timeout));
            }

            // If analysis completed, fetch the analysis ID to check quality gate status
            return sqRest.getAnalysisId(taskReport)
        })
        .then((analysisId:string) => {
            return sqRest.getAnalysisStatus(analysisId);
        })
        .then((analysisStatus:string) => {
            return sqQualityGate.createBuildSummaryQualityGateSection(analysisStatus)
        });
}

// Creates a string containing Markdown of a link to the SonarQube dashboard for this project.
function createLinkToSonarQubeDashboard(taskReport: TaskReport): string {
    if (!taskReport) {
        // Looks like: Invalid or missing task report. Check SonarQube finished successfully.
        throw new Error(tl.loc('sqAnalysis_TaskReportInvalid'));
    }

    // Looks like: Detailed SonarQube report
    var linkText:string = tl.loc('sqAnalysis_BuildSummary_LinkText');
    return `[${linkText} >](${taskReport.dashboardUrl} \"${taskReport.projectKey} Dashboard\")`;
}

// Returns, as an object, the contents of the 'report-task.txt' file created by SonarQube plugins
// The returned object contains the following properties:
//   projectKey, serverUrl, dashboardUrl, ceTaskId, ceTaskUrl
function getSonarQubeTaskReport(sonarPluginFolder: string): TaskReport {
    var reportFilePath:string = path.join(sonarPluginFolder, 'report-task.txt');
    if (!tl.exist(reportFilePath)) {
        tl.debug('Task report not found at: ' + reportFilePath);
        // Looks like: Invalid or missing task report. Check SonarQube finished successfully.
        throw new Error(tl.loc('sqAnalysis_TaskReportInvalid'));
    }

    return createTaskReportFromFile(reportFilePath);
}

// Constructs a map out of an existing report-task.txt file. File must exist on disk.
function createTaskReportFromFile(taskReportFile: string): TaskReport {
    var reportFileString: string = fs.readFileSync(taskReportFile, 'utf-8');
    if (!reportFileString || reportFileString.length < 1) {
        tl.debug('Error reading file:' + reportFileString);
        // Looks like: Invalid or missing task report. Check SonarQube finished successfully.
        throw new Error(tl.loc('sqAnalysis_TaskReportInvalid'));
    }

    var reportLines: string[] = reportFileString.replace(/\r\n/g, '\n').split('\n'); // proofs against xplat line-ending issues

    var reportMap = new Map<string, string>();
    reportLines.forEach((reportLine:string) => {
        var splitLine: string[] = reportLine.split('=');
        if (splitLine.length > 1) {
            reportMap.set(splitLine[0], splitLine.slice(1, splitLine.length).join());
        }
    });

    try {
        return TaskReport.createTaskReportFromMap(reportMap);
    } catch (err) {
        tl.debug(err.message);
        // Looks like: Invalid or missing task report. Check SonarQube finished successfully.
        throw new Error(tl.loc('sqAnalysis_TaskReportInvalid'));
    }
}

// Saves the build summary string and returns the file path it was saved to.
function saveSonarQubeBuildSummary(contents: string): string {
    var filePath:string = path.join(getOrCreateSonarQubeStagingDirectory(), 'SonarQubeBuildSummary.md');
    fs.writeFileSync(filePath, contents);
    return filePath;
}
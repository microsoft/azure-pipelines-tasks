/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import fs = require('fs');

import tl = require('vsts-task-lib/task');
import {ToolRunner} from 'vsts-task-lib/toolrunner';

// Simple data class for a SonarQube generic endpoint
export class SonarQubeEndpoint {
    constructor(public Url, public Username, public Password) {
    }
}

// Applies required parameters for connecting a Java-based plugin (Maven, Gradle) to SonarQube.
// sqDbUrl, sqDbUsername and sqDbPassword are required if the SonarQube version is less than 5.2.
export function applySonarQubeConnectionParams(toolRunner: ToolRunner, sqHostUrl, sqHostUsername, sqHostPassword, sqDbUrl?, sqDbUsername?, sqDbPassword?): ToolRunner {
    toolRunner.arg('-Dsonar.host.url=' + sqHostUrl);
    toolRunner.arg('-Dsonar.login=' + sqHostUsername);
    toolRunner.arg('-Dsonar.password=' + sqHostPassword);

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
export function applySonarQubeAnalysisParams(toolRunner: ToolRunner, sqProjectName?, sqProjectKey?, sqProjectVersion?): ToolRunner {
    if (sqProjectName) {
        toolRunner.arg('-Dsonar.projectName=' + sqProjectName);
    }
    if (sqProjectKey) {
        toolRunner.arg('-Dsonar.projectKey=' + sqProjectKey);
    }
    if (sqProjectVersion) {
        toolRunner.arg('-Dsonar.projectVersion=' + sqProjectVersion);
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
export function getSonarQubeEndpointFromInput(inputFieldName): SonarQubeEndpoint {
    var errorMessage = "Could not decode the generic endpoint. Please ensure you are running the latest agent (min version 0.3.2)";
    if (!tl.getEndpointUrl) {
        throw new Error(errorMessage);
    }

    var genericEndpoint = tl.getInput(inputFieldName);
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

// Returns, as an object, the contents of the 'report-task.txt' file created by SonarQube plugins
// The returned object contains the following properties:
//   projectKey, serverUrl, dashboardUrl, ceTaskId, ceTaskUrl
export function getSonarQubeTaskReport(sonarPluginFolder: string) {
    var reportFilePath:string = path.join(sonarPluginFolder, 'report-task.txt');
    if (!tl.exist(reportFilePath)) {
        tl.debug('Task report not found at: ' + reportFilePath);
        return null;
    }

    var reportFileString: string = fs.readFileSync(reportFilePath, 'utf-8');
    var reportLines: string[] = reportFileString.replace(/\r\n/g, '\n').split('\n'); // proofs against xplat line-ending issues

    var reportObject = {};
    reportLines.forEach((reportLine:string) => {
        var reportKeyValuePair: string[] = reportLine.split('=');
        reportObject[reportKeyValuePair[0]] = reportKeyValuePair[1]
    });

    return reportObject;
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
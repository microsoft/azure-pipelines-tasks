/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import fs = require('fs');
import util = require('util');

import {ToolRunner} from 'vsts-task-lib/toolrunner';
import tl = require('vsts-task-lib/task');

import {ModuleAnalysis} from './moduleanalysis';
import {SonarQubeEndpoint} from 'sonarqube-common/sonarqube-common';
import codeAnalysis = require('./mavencodeanalysis');
import sqCommon = require('sonarqube-common/sonarqube-common');

export const toolName:string = 'SonarQube';

// Gets the SonarQube tool runner if SonarQube analysis is enabled.
export function getSonarQubeRunner(mvnPath:string, mavenPOMFile: string, mavenOptions: string, execFileJacoco?: string): ToolRunner {
    if (!codeAnalysis.isCodeAnalysisToolEnabled(this.toolName)) {
        return;
    }

    var mvnsq: ToolRunner;
    var sqEndpoint: SonarQubeEndpoint = sqCommon.getSonarQubeEndpointFromInput("sqConnectedServiceName");

    if (tl.getBoolInput('sqDbDetailsRequired')) {
        var sqDbUrl = tl.getInput('sqDbUrl', false);
        var sqDbUsername = tl.getInput('sqDbUsername', false);
        var sqDbPassword = tl.getInput('sqDbPassword', false);
        mvnsq = createMavenSonarQubeRunner(mvnPath, sqEndpoint.Url, sqEndpoint.Username, sqEndpoint.Password, sqDbUrl, sqDbUsername, sqDbPassword);
    }
    else {
        mvnsq = createMavenSonarQubeRunner(mvnPath, sqEndpoint.Url, sqEndpoint.Username, sqEndpoint.Password);
    }

    // Apply argument for the JaCoCo tool, if enabled
    if (typeof execFileJacoco != "undefined" && execFileJacoco) {
        mvnsq.arg('-Dsonar.jacoco.reportPath=' + execFileJacoco);
    }

    mvnsq.arg('-f');
    mvnsq.pathArg(mavenPOMFile);
    mvnsq.argString(mavenOptions); // add the user options to allow further customization of the SQ run
    mvnsq = sqCommon.applySonarQubeIssuesModeInPrBuild(mvnsq); // in PR builds run SQ in issues mode
    mvnsq.arg("sonar:sonar");

    return mvnsq;
}

// Upload a build summary with links to available SonarQube dashboards for further analysis details.
export function uploadSonarQubeBuildSummary(): void {
    var taskReport: Map<string, string> =
        sqCommon.getSonarQubeTaskReport(path.join(tl.getVariable('build.sourcesDirectory'), 'target', 'sonar'));

    // Save and upload build summary
    // Looks like: "[Detailed SonarQube report >](https://mySQserver:9000/dashboard/index/foo "foo Dashboard")"
    var buildSummaryContents:string = createSonarQubeBuildSummary(taskReport);

    var buildSummaryFilePath = saveSonarQubeBuildSummary(buildSummaryContents);
    tl.debug('Uploading build summary from ' + buildSummaryFilePath);

    tl.command('task.addattachment', {
        'type': 'Distributedtask.Core.Summary',
        'name': tl.loc('sqAnalysis_BuildSummaryTitle')
    }, buildSummaryFilePath);
}

// Creates the tool runner for executing SonarQube.
function createMavenSonarQubeRunner(mvnPath: string, sqHostUrl: string, sqHostUsername: string, sqHostPassword:string,
                                    sqDbUrl?: string, sqDbUsername?: string, sqDbPassword?: string) {
    var mvnsq = tl.createToolRunner(mvnPath);

    mvnsq = sqCommon.applySonarQubeConnectionParams(mvnsq, sqHostUrl, sqHostUsername, sqHostPassword, sqDbUrl, sqDbUsername, sqDbPassword);

    return mvnsq;
}

// Creates the string that comprises the build summary text.
function createSonarQubeBuildSummary(taskReport: Map<string, string>): string {
    return util.format('[%s >](%s "%s Dashboard")',
        tl.loc('sqAnalysisBuildSummaryLine_OneProject'), taskReport.get('dashboardUrl'), taskReport.get('projectKey'));
}

// Saves the build summary string and returns the file path it was saved to.
function saveSonarQubeBuildSummary(contents: string): string {
    var filePath:string = path.join(codeAnalysis.getCodeAnalysisStagingDirectory(), 'SonarQubeBuildSummary.md');
    fs.writeFileSync(filePath, contents);
    return filePath;
}
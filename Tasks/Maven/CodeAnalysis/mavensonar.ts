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
    // Collect all unique dashboard URLs
    // project key -> dashboard URL
    var dashboardUrlsByProjectKey: Map<string, string> = new Map<string, string>();

    var sourcesDir = tl.getVariable('build.sourcesDirectory');
    var modules:ModuleAnalysis[] = codeAnalysis.findCandidateModules(sourcesDir);
    modules.forEach((module: ModuleAnalysis) => {
        var taskReport = sqCommon.getSonarQubeTaskReport(path.join(module.rootDirectory, 'target', 'sonar'));
        if (taskReport) {
            dashboardUrlsByProjectKey.set(taskReport['projectKey'], taskReport['dashboardUrl']);
        }
    });

    dashboardUrlsByProjectKey.delete(null);

    if (dashboardUrlsByProjectKey.size < 1) {
        tl.debug('Expected to find SonarQube report file(s) on disk, but found none.');
        return;
    }

    // Create a build summary line-by-line, write it out and upload
    var buildSummaryLines:string[] = [];
    var lineBodyText:string;

   for (let projectKey of dashboardUrlsByProjectKey.keys()) {
       // If there is more than one project key, we will append it to the build summary line text
       if (dashboardUrlsByProjectKey.size > 1) {
           // Looks like: "Detailed SonarQube report (foo)"
           lineBodyText = tl.loc('sqAnalysisBuildSummaryLine_SomeProjects', projectKey);
       } else {
           // Looks like: "Detailed SonarQube report"
           lineBodyText = tl.loc('sqAnalysisBuildSummaryLine_OneProject');
       }

       buildSummaryLines.push(util.format('[%s >](%s "%s Dashboard")',
           lineBodyText, dashboardUrlsByProjectKey.get(projectKey), projectKey));
   };

    // Save and upload build summary
    // Looks like: "[Detailed SonarQube report (foo) >](https://mySQserver:9000/dashboard/index/foo "foo Dashboard")  \r\n
    // [Detailed SonarQube report (bar) >](https://mySQserver:9000/dashboard/index/bar "bar Dashboard")  \r\n"
    var buildSummaryContents:string = buildSummaryLines.join("  \r\n"); // Double space is end of line in markdown
    var buildSummaryFilePath:string = path.join(codeAnalysis.getMasterStagingDirectory(), 'SonarQubeBuildSummary.md');
    fs.writeFileSync(buildSummaryFilePath, buildSummaryContents);
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
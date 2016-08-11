/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');

import {ToolRunner} from 'vsts-task-lib/toolrunner';

import {SonarQubeEndpoint} from './endpoint';
import sqCommon = require('./common');
import {VstsServerUtils} from './vsts-server-utils';

export class SonarQubeParameterHelper {

    /**
     * Applies parameters for SonarQube features enabled by the user.
     * @param toolRunner     ToolRunner to add parameters to
     * @returns {ToolRunner} ToolRunner with parameters added
     */
    public static applySonarQubeParameters(toolRunner: ToolRunner): ToolRunner {
        toolRunner = SonarQubeParameterHelper.applySonarQubeConnectionParams(toolRunner);
        toolRunner = SonarQubeParameterHelper.applySonarQubeAnalysisParams(toolRunner);
        toolRunner = SonarQubeParameterHelper.applySonarQubeIssuesModeInPrBuild(toolRunner);
        return toolRunner;
    }

    /**
     * Applies required parameters for connecting a Java-based plugin (Maven, Gradle) to SonarQube.
     * @param toolRunner     ToolRunner to add parameters to
     * @returns {ToolRunner} ToolRunner with parameters added
     */
    private static applySonarQubeConnectionParams(toolRunner: ToolRunner): ToolRunner {
        var sqEndpoint: SonarQubeEndpoint = SonarQubeEndpoint.getTaskSonarQubeEndpoint();
        toolRunner.arg('-Dsonar.host.url=' + sqEndpoint.Url);
        toolRunner.arg('-Dsonar.login=' + sqEndpoint.Username);
        toolRunner.arg('-Dsonar.password=' + sqEndpoint.Password);

        // sqDbUrl, sqDbUsername and sqDbPassword are required if the SonarQube version is less than 5.2.
        var sqDbUrl = tl.getInput('sqDbUrl', false);
        var sqDbUsername = tl.getInput('sqDbUsername', false);
        var sqDbPassword = tl.getInput('sqDbPassword', false);

        if (sqDbUrl != undefined && sqDbUrl != null) {
            toolRunner.arg('-Dsonar.jdbc.url=' + sqDbUrl);
        }
        if (sqDbUsername != undefined && sqDbUsername != null) {

            toolRunner.arg('-Dsonar.jdbc.username=' + sqDbUsername);
        }
        if (sqDbPassword != undefined && sqDbPassword != null) {
            toolRunner.arg('-Dsonar.jdbc.password=' + sqDbPassword);
        }

        return toolRunner;
    }

    /**
     * Applies parameters for manually specifying the project name, key and version to SonarQube.
     * This will override any settings that may have been specified manually by the user.
     * @param toolRunner     ToolRunner to add parameters to
     * @returns {ToolRunner} ToolRunner with parameters added
     */
    private static applySonarQubeAnalysisParams(toolRunner: ToolRunner): ToolRunner {
        var projectName:string = tl.getInput('sqProjectName', false);
        var projectKey:string = tl.getInput('sqProjectKey', false);
        var projectVersion:string = tl.getInput('sqProjectVersion', false);

        if (projectName != null && projectName != undefined) {
            toolRunner.arg('-Dsonar.projectName=' + projectName);
        }
        if (projectKey != null && projectKey != undefined) {
            toolRunner.arg('-Dsonar.projectKey=' + projectKey);
        }
        if (projectVersion != null && projectName != undefined) {
            toolRunner.arg('-Dsonar.projectVersion=' + projectVersion);
        }

        return toolRunner;
    }

    /**
     * Applies parameters that will run SQ analysis in issues mode if this is a pull request build
     * @param toolRunner     ToolRunner to add parameters to
     * @returns {ToolRunner} ToolRunner with parameters added
     */
    private static applySonarQubeIssuesModeInPrBuild(toolrunner: ToolRunner): ToolRunner {
        if (VstsServerUtils.isPrBuild()) {
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

}
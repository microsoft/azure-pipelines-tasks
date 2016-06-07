/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/sonarqube-common.d.ts" />

import path = require('path');
import fs = require('fs');

import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

// Lowercased file names are to lessen the likelihood of xplat issues
import sqCommon = require('sonarqube-common/sonarqube-common');
import {SonarQubeEndpoint} from 'sonarqube-common/sonarqube-common';

// Set up localization resource file
tl.setResourcePath(path.join( __dirname, 'task.json'));

// Apply arguments to enable SonarQube analysis
export function applyEnabledSonarQubeArguments(gradleRun: trm.ToolRunner):trm.ToolRunner {
    if (!isSonarQubeEnabled()) {
        // Looks like: 'SonarQube analysis is not enabled.'
        console.log(tl.loc('sqAnalysis_isNotEnabled'));
        return gradleRun;
    }

    // Looks like: 'SonarQube analysis is enabled.'
    console.log(tl.loc('sqAnalysis_isEnabled'));

    // #1: Inject custom script to the Gradle build, triggering a SonarQube run
    // Add a custom initialisation script to the Gradle run that will apply the SonarQube plugin and task
    var initScriptPath:string = path.join(__dirname, 'sonar.gradle');

    // Specify that the build should run the init script
    gradleRun.arg(['sonarqube']);
    gradleRun.arg(['-I', initScriptPath]);

    // #2: Configure additional command-line parameters
    // Add parameters to connect to the SonarQube server for reporting
    var sqEndpoint:SonarQubeEndpoint = sqCommon.getSonarQubeEndpointFromInput("sqConnectedServiceName");

    // SQ servers lower than 5.2 require additional parameters (null if not set / not required)
    if (tl.getBoolInput('sqDbDetailsRequired')) {
        var sqDbUrl:string = tl.getInput('sqDbUrl', false);
        var sqDbUsername:string = tl.getInput('sqDbUsername', false);
        var sqDbPassword:string = tl.getInput('sqDbPassword', false);
        gradleRun = sqCommon.applySonarQubeConnectionParams(gradleRun, sqEndpoint.Url, sqEndpoint.Username, sqEndpoint.Password, sqDbUrl, sqDbUsername, sqDbPassword);
    }
    else {
        gradleRun = sqCommon.applySonarQubeConnectionParams(gradleRun, sqEndpoint.Url, sqEndpoint.Username, sqEndpoint.Password);
    }

    // Add parameters to specify the SonarQube project properties (if given by the user)
    var projectName:string = tl.getInput('sqProjectName', true);
    var projectKey:string = tl.getInput('sqProjectKey', true);
    var projectVersion:string = tl.getInput('sqProjectVersion', true);
    gradleRun = sqCommon.applySonarQubeAnalysisParams(gradleRun, projectName, projectKey, projectVersion);

    return gradleRun;
}

// Points SonarQube to the CC file as it is in a non-standard location. Not required for Jacoco. 
export function applySonarQubeCodeCoverageArguments(gradleRun: trm.ToolRunner, isCodeCoverageEnabled:boolean, ccTool:string, reportPath:string):trm.ToolRunner {
    
    if (isSonarQubeEnabled() && isCodeCoverageEnabled && ccTool.toLowerCase() == "cobertura" && reportPath ) {
        gradleRun.arg("-Dsonar.cobertura.reportPath="+reportPath);
    }
    
    return gradleRun;
}

function isSonarQubeEnabled():boolean {
    return tl.getBoolInput('sqAnalysisEnabled')
}
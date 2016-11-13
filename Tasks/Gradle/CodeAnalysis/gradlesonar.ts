/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import path = require('path');
import fs = require('fs');
import glob = require('glob');

import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

// Lowercased file names are to lessen the likelihood of xplat issues
import sqCommon = require('../CodeAnalysis/SonarQube/common');
import {SonarQubeEndpoint} from '../CodeAnalysis/SonarQube/endpoint';

// Apply arguments to enable SonarQube analysis.
// Returns the changed toolRunner. Has no effect if SonarQube is not enabled.
export function applyEnabledSonarQubeArguments(gradleRun: trm.ToolRunner):trm.ToolRunner {
    if (!sqCommon.isSonarQubeAnalysisEnabled()) {
        return gradleRun;
    }

    // #1: Inject custom script to the Gradle build, triggering a SonarQube run
    // Add a custom initialisation script to the Gradle run that will apply the SonarQube plugin and task
    var initScriptPath:string = path.join(__dirname, 'sonar.gradle');

    // Specify that the build should run the init script
    gradleRun.arg(['sonarqube']);
    gradleRun.arg(['-I', initScriptPath]);

    // #2: Configure additional command-line parameters
    // Add parameters to connect to the SonarQube server for reporting
    gradleRun = sqCommon.applySonarQubeParameters(gradleRun);

    return gradleRun;
}

// Points SonarQube to the CC file as it is in a non-standard location. Not required for Jacoco.
// Returns the changed toolRunner. Has no effect if SonarQube or code coverage is not enabled.
export function applySonarQubeCodeCoverageArguments(gradleRun: trm.ToolRunner, isCodeCoverageEnabled:boolean, ccTool:string, reportPath:string):trm.ToolRunner {
    // Apply relevant arguments if both SonarQube and code coverage features are enabled
    if (sqCommon.isSonarQubeAnalysisEnabled() && isCodeCoverageEnabled && ccTool.toLowerCase() == "cobertura" && reportPath ) {
        gradleRun.arg("-Dsonar.cobertura.reportPath="+reportPath);
    }

    return gradleRun;
}

// Upload a build summary with links to available SonarQube dashboards for further analysis details.
export function processSonarQubeIntegration(): Q.Promise<void> {
    if (!sqCommon.isSonarQubeAnalysisEnabled()) {
        return Q.when();
    }

      // the output folder may not be directly in the build root, for example if the entire project is in a top-lvel dir
    var reportTaskGlob: string = path.join(tl.getVariable('build.sourcesDirectory'), '**', 'build', 'sonar', 'report-task.txt');
   
    return sqCommon.processSonarQubeIntegration(reportTaskGlob);
}


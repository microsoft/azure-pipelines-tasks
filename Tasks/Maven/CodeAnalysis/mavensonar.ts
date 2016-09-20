/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import path = require('path');
import fs = require('fs');
import util = require('util');


import {ToolRunner} from 'vsts-task-lib/toolrunner';
import tl = require('vsts-task-lib/task');

import {SonarQubeEndpoint} from './SonarQube/endpoint';
import sqCommon = require('./SonarQube/common');

// Applies any applicable SonarQube arguments to the supplied ToolRunner.
export function applySonarQubeArgs(mvnsq: ToolRunner, execFileJacoco?: string): ToolRunner {
    if (!sqCommon.isSonarQubeAnalysisEnabled()) {
        return mvnsq;
    }

    mvnsq = sqCommon.applySonarQubeParameters(mvnsq);

    // Apply argument for the JaCoCo tool, if enabled
    if (typeof execFileJacoco != "undefined" && execFileJacoco) {
        mvnsq.arg('-Dsonar.jacoco.reportPath=' + execFileJacoco);
    }

    mvnsq.arg("sonar:sonar");

    return mvnsq;
}

// Effect any user-enabled SonarQube integration options. Has no effect if SonarQube analysis is not enabled.
// 1. Create a build summary
// 2. Wait for analysis to complete, then add quality gate details
// 3. Fail the build if quality gate was failed.
export function processSonarQubeIntegration(): Q.Promise<void> {
    if (!sqCommon.isSonarQubeAnalysisEnabled()) {
        return Q.when();
    }

    // the output folder may not be directly in the build root, for example if the entire project is in a top-lvel dir
    var reportTaskGlob: string = path.join(tl.getVariable('build.sourcesDirectory'), '**', 'target', 'sonar', 'report-task.txt');
   
    return sqCommon.processSonarQubeIntegration(reportTaskGlob);
}
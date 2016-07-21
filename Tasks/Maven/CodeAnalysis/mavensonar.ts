/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import path = require('path');
import fs = require('fs');
import util = require('util');

import {ToolRunner} from 'vsts-task-lib/toolrunner';
import tl = require('vsts-task-lib/task');

import {ModuleAnalysis} from './moduleanalysis';
import {SonarQubeEndpoint} from '../sonarqube-common/sonarqube-common';
import codeAnalysis = require('./mavencodeanalysis');
import sqCommon = require('../sonarqube-common/sonarqube-common');

// Applies any applicable SonarQube arguments to the supplied ToolRunner.
export function applySonarQubeArgs(mvnsq: ToolRunner, execFileJacoco?: string): ToolRunner {
    if (!sqCommon.isSonarQubeAnalysisEnabled()) {
        return mvnsq;
    }

    mvnsq = sqCommon.applySonarQubeConnectionParams(mvnsq);

    // Apply argument for the JaCoCo tool, if enabled
    if (typeof execFileJacoco != "undefined" && execFileJacoco) {
        mvnsq.arg('-Dsonar.jacoco.reportPath=' + execFileJacoco);
    }

    mvnsq = sqCommon.applySonarQubeIssuesModeInPrBuild(mvnsq); // in PR builds run SQ in issues mode
    mvnsq.arg("sonar:sonar");

    return mvnsq;
}

// Upload a build summary with links to available SonarQube dashboards for further analysis details.
// Has no effect if SonarQube analysis is not enabled.
export function uploadSonarQubeBuildSummaryIfEnabled(): Q.Promise<void> {
    if (!sqCommon.isSonarQubeAnalysisEnabled()) {
        return Q.when();
    }

    var sqBuildFolder: string = path.join(tl.getVariable('build.sourcesDirectory'), 'target', 'sonar');
    return sqCommon.uploadSonarQubeBuildSummaryIfEnabled(sqBuildFolder);
}
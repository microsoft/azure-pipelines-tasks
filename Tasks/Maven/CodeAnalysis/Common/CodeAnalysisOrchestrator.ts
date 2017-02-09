import {AnalysisResult} from './AnalysisResult'
import {BuildOutput} from './BuildOutput'
import {IAnalysisTool} from './IAnalysisTool'
import {PmdTool} from './PmdTool'
import {CodeAnalysisResultPublisher} from './CodeAnalysisResultPublisher'

import {ToolRunner} from 'vsts-task-lib/toolrunner';

import path = require('path');
import fs = require('fs');
import glob = require('glob');
import xml2js = require('xml2js');

import tl = require('vsts-task-lib/task');



/**
 * Orcheestrates the processing and publishing of code analysis data and artifacts (PMD, FindBugs etc. but not SonarQube)
 *
 * @export
 * @class CodeAnalysisOrchestrator
 */
export class CodeAnalysisOrchestrator {

    constructor(private tools: IAnalysisTool[]) {
    }

    public configureBuild(toolRunner: ToolRunner): ToolRunner {

        if (this.checkBuildContext()) {
            for (var tool of this.tools) {
                toolRunner = tool.configureBuild(toolRunner);
            }
        }

        return toolRunner;
    }

    /**
     * Parses the code analysis tool results (PMD, CheckStyle .. but not SonarQube). Uploads reports and artifacts.
     */
    public publishCodeAnalysisResults(): void {

        if (this.checkBuildContext() && this.tools.length > 0) {
            tl.debug(`[CA] Attempting to find report files from ${this.tools.length} code analysis tool(s)`);

            let analysisResults = this.processResults(this.tools);

            if (analysisResults.length < 1) {
                tl.debug('[CA] Skipping artifact upload: No analysis results');
                return;
            }

            let stagingDir = path.join(tl.getVariable('build.artifactStagingDirectory'), ".codeAnalysis");
            let buildNumber: string = tl.getVariable('build.buildNumber');

            let resultPublisher = new CodeAnalysisResultPublisher(analysisResults, stagingDir);

            var uploadedArtifacts:number = resultPublisher.uploadArtifacts(buildNumber);
            resultPublisher.uploadBuildSummary(uploadedArtifacts);
        }
    }

    private processResults(tools: IAnalysisTool[]): AnalysisResult[] {

        let analysisResults: AnalysisResult[] = [];

        for (var tool of tools) {
            var results: AnalysisResult[] = tool.processResults();
            if (results != undefined && results != null && results.length > 0) {
                analysisResults = analysisResults.concat(results);
            }
        }

        return analysisResults;
    }

    private checkBuildContext(): boolean {
        let requiredVariables: string[] = ['System.DefaultWorkingDirectory', 'build.artifactStagingDirectory', 'build.buildNumber'];

        for (var requiredVariable of requiredVariables) {
            if (!tl.getVariable(requiredVariable)) {
                console.log(tl.loc('codeAnalysisDisabled', requiredVariable));
                return false;
            }
        }

        return true;
    }
}
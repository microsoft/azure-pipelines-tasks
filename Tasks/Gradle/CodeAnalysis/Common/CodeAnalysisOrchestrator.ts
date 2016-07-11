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
        for (var tool of this.tools) {
            toolRunner = tool.configureBuild(toolRunner);
        }

        return toolRunner;
    }

    /**
     * Parses the code analysis tool results (PMD, CheckStyle .. but not SonarQube). Uploads reports and artifacts.
     */
    public publishCodeAnalysisResults() {

        let stagingDir = path.join(tl.getVariable('build.artifactStagingDirectory'), ".codeAnalysis");
        let buildNumber: string = tl.getVariable('build.buildNumber');

        tl.debug(`[CA] Detected ${this.tools.length} tool(s)`);

        if (this.tools.length > 0) {
            let analysisResults = this.processResults(this.tools);

            let resultPublisher = new CodeAnalysisResultPublisher(analysisResults, stagingDir);

            resultPublisher.uploadBuildSummary();
            resultPublisher.uploadArtifacts(buildNumber);
        }
    }

    private processResults(tools: IAnalysisTool[]) {

        let analysisResults: AnalysisResult[] = [];

        for (var tool of tools) {
            var results = tool.processResults();
            if (results) {
                analysisResults = analysisResults.concat(results);
            }
        }

        return analysisResults;
    }
}
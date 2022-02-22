import { AnalysisResult } from './AnalysisResult';
import { IAnalysisTool } from './IAnalysisTool';
import { CodeAnalysisResultPublisher } from './CodeAnalysisResultPublisher';

import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

import path = require('path');

import * as tl from 'azure-pipelines-task-lib/task';

/**
 * Orcheestrates the processing and publishing of code analysis data and artifacts (PMD, FindBugs etc. but not SonarQube)
 *
 * @export
 * @class CodeAnalysisOrchestrator
 */
export class CodeAnalysisOrchestrator {
    constructor(private tools: IAnalysisTool[]) { }

    public configureBuild(toolRunner: ToolRunner | any): ToolRunner | any {
        tl.debug('Count of tools = ' + this.tools.length)
        // tl.debug('Tools: ' + this.tools.reduce((acc, t) => acc += ' ' + t.toolName, ''))
        if (this.checkBuildContext()) {
            for (let tool of this.tools) {
                tl.debug('Current tool: ' + tool.toolName)
                toolRunner = tool.configureBuild(toolRunner);
                tl.debug('Tool runner: ' + JSON.stringify(toolRunner))
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

            let analysisResults: AnalysisResult[] = this.processResults(this.tools);
            if (analysisResults.length < 1) {
                tl.debug('[CA] Skipping artifact upload: No analysis results');
                return;
            }

            let stagingDir: string = path.join(tl.getVariable('build.artifactStagingDirectory'), '.codeAnalysis');
            let buildNumber: string = tl.getVariable('build.buildNumber');

            let resultPublisher: CodeAnalysisResultPublisher = new CodeAnalysisResultPublisher(analysisResults, stagingDir);

            let uploadedArtifacts: number = resultPublisher.uploadArtifacts(buildNumber);
            resultPublisher.uploadBuildSummary(uploadedArtifacts);
        }
    }

    private processResults(tools: IAnalysisTool[]): AnalysisResult[] {
        let analysisResults: AnalysisResult[] = [];

        for (let tool of tools) {
            let results: AnalysisResult[] = tool.processResults();
            if (results !== undefined && results !== null && results.length > 0) {
                analysisResults = analysisResults.concat(results);
            }
        }

        return analysisResults;
    }

    private checkBuildContext(): boolean {
        let requiredVariables: string[] = ['System.DefaultWorkingDirectory', 'build.artifactStagingDirectory', 'build.buildNumber'];

        for (let requiredVariable of requiredVariables) {
            if (!tl.getVariable(requiredVariable)) {
                console.log(tl.loc('codeAnalysisDisabled', requiredVariable));
                return false;
            }
        }

        return true;
    }
}

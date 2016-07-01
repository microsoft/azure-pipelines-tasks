import {AnalysisResult} from './AnalysisResult'
import {BuildOutput} from './BuildOutput'
import {IAnalysisToolReportParser} from './IAnalysisToolReportParser'
import {PmdReportParser} from './PmdReportParser'
import {CodeAnalysisResultPublisher} from './CodeAnalysisResultPublisher'

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

    private parsed: boolean = false;
    private analysisResults: AnalysisResult[] = [];

    constructor(private buildOutput: BuildOutput, private stagingDir: string, private buildNumber: string) {
        if (!buildOutput) {
            throw new ReferenceError('buildOutput');
        }
    }

    public static IsPMDEnabled() {
        return tl.getBoolInput('pmdAnalysisEnabled', false);
    }

    /**
     * Parses the code analysis tool results (PMD, CheckStyle .. but not SonarQube). Uploads reports and artifacts.
     */
    public orchestrateCodeAnalysisProcessing() {
        let parsers: IAnalysisToolReportParser[] = [];

        if (CodeAnalysisOrchestrator.IsPMDEnabled()) {
            let pmdParser = new PmdReportParser(this.buildOutput);
            parsers.push(pmdParser);
        }

        tl.debug(`[CA] Detected ${parsers.length} parsers`);

        if (parsers.length > 0) {
            this.processResults(parsers);

            let resultPublisher = new CodeAnalysisResultPublisher(this.analysisResults, this.stagingDir);

            resultPublisher.uploadBuildSummary();
            resultPublisher.uploadArtifacts(this.buildNumber);
        }
    }

    private processResults(parsers: IAnalysisToolReportParser[]): AnalysisResult[] {
        if (!this.parsed) {

            for (var parser of parsers) {
                var results = parser.parse();
                this.analysisResults = this.analysisResults.concat(results);
            }

            this.parsed = true;
        }

        return this.analysisResults;
    }
}
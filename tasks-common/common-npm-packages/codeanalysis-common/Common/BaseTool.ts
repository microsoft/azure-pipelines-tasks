import { AnalysisResult } from './AnalysisResult';
import { IAnalysisTool } from './IAnalysisTool';
import { BuildOutput } from './BuildOutput';
import { ModuleOutput } from './ModuleOutput';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

import path = require('path');
import glob = require('glob');

import * as tl from 'azure-pipelines-task-lib/task';

/**
 * An abstract class that is the base for both configuring a build to use an analysis tool and 
 * parsing reports
 * 
 * @export
 * @class BaseTool
 * @implements {IAnalysisTool}
 */
export abstract class BaseTool implements IAnalysisTool {
    constructor(public toolName: string, protected buildOutput: BuildOutput, private uiInputName: string) { }

    /**
     * This method lets implementers specify where the reports are located
     * 
     * @protected
     * @abstract
     * @param {ModuleOutput} output
     */
    protected abstract getBuildReportDir(output: ModuleOutput): string;

    /**
     * Report parser that extracts the number of affected files and the number of violations from a report
     * 
     * @protected
     * @abstract
     * @param {string} xmlReport
     * @param {string} moduleName
     * @returns {[number, number]} a tuple of [affected_file_count, violation_count]
     */
    protected abstract parseXmlReport(xmlReport: string, moduleName: string): [number, number];

    /**
     * Configures the provided ToolRunner instance with arguments which will invoke the tool represented by this class.
     * @param toolRunner
     * @returns {ToolRunner} ToolRunner instance with arguments applied
     */
    public abstract configureBuild(toolRunner: ToolRunner): ToolRunner;

    public processResults(): AnalysisResult[] {
        if (!this.isEnabled()) {
            tl.debug(`[CA] ${this.toolName} analysis is not enabled.`);
            return [];
        }

        let results: AnalysisResult[] = [];
        let outputs: ModuleOutput[] = this.buildOutput.findModuleOutputs();
        tl.debug(`[CA] ${this.toolName} parser found ${outputs.length} possible modules to upload results from.`);

        for (let output of outputs) {
            let result = this.parseModuleOutput(output);
            if (result) {
                results.push(result);
            }
        }

        return results;
    }

    public isEnabled(): boolean {
        return tl.getBoolInput(this.uiInputName, false);
    }

    protected findHtmlReport(xmlReport: string): string {
        // expecting to find an html report with the same name
        let reportName: string = path.basename(xmlReport, '.xml');
        let dirName: string = path.dirname(xmlReport);

        let htmlReports: string[] = glob.sync(path.join(dirName, '**', reportName + '.html'));
        if (htmlReports.length > 0) {
            return htmlReports[0];
        }

        return null;
    }

    private parseModuleOutput(output: ModuleOutput): AnalysisResult {
        let reportDir: string = this.getBuildReportDir(output);

        let xmlReports: string[] = glob.sync(path.join(reportDir, '*.xml'));
        if (xmlReports.length === 0) {
            tl.debug(`[CA] No ${this.toolName} reports found for the ${output.moduleName} module. Searched in ${reportDir}`);
            return null;
        }

        tl.debug(`[CA] Found ${xmlReports.length} xml reports for module ${output.moduleName}`);
        return this.buildAnalysisResultFromModule(xmlReports, output.moduleName);
    }

    private buildAnalysisResultFromModule(xmlReports: string[], moduleName: string): AnalysisResult {
        let fileCount: number = 0;
        let violationCount: number = 0;
        let artifacts: string[] = [];

        for (let xmlReport of xmlReports) {
            let result: [number, number] = this.parseXmlReport(xmlReport, moduleName);

            if (result && (result[0] !== 0)) {
                violationCount += result[0];
                fileCount += result[1];
                artifacts.push(xmlReport);

                let htmlReport: string = this.findHtmlReport(xmlReport);
                if (htmlReport) {
                    artifacts.push(htmlReport);
                }
            } else {
               tl.debug(`[CA] ${this.toolName} report for module ${moduleName} was empty and will be ignored.`);
            }
        }

        return new AnalysisResult(this, moduleName, artifacts, violationCount, fileCount);
    }
}

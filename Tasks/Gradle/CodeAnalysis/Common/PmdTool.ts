import {AnalysisResult} from './AnalysisResult'
import {IAnalysisTool} from './IAnalysisTool'
import {BuildOutput, BuildEngine} from './BuildOutput'
import {ModuleOutput} from './ModuleOutput'
import {ToolRunner} from 'vsts-task-lib/toolrunner';

import path = require('path');
import fs = require('fs');
import glob = require('glob');
import xml2js = require('xml2js');

import tl = require('vsts-task-lib/task');


/**
 * An object that is able to configure the build to run PMD and identify and parse PMD reports
 * 
 * @export
 * @class PmdReportParser
 * @implements {IAnalysisToolReportParser}
 */
export class PmdTool implements IAnalysisTool {

    private static Name: string = 'PMD';

    constructor(private buildOutput: BuildOutput) {

    }

    private isEnabled(): boolean {
        return tl.getBoolInput('pmdAnalysisEnabled', false);
    }

    public configureBuild(toolRunner: ToolRunner): ToolRunner {
        switch (this.buildOutput.buildEngine) {
            case BuildEngine.Maven: {
                throw new Error('Not implemented');
            }
            case BuildEngine.Gradle: {

                if (this.isEnabled()) {
                    console.log(tl.loc('codeAnalysis_ToolIsEnabled'), PmdTool.Name);

                    var pmdInitScriptPath: string = path.join(__dirname, '../', 'pmd.gradle');
                    toolRunner.arg(['-I', pmdInitScriptPath]);
                    break;
                }
            }
        }
        return toolRunner;
    }


    public processResults(): AnalysisResult[] {

        if (!this.isEnabled()) {
            return [];
        }

        var results: AnalysisResult[] = [];
        var outputs: ModuleOutput[] = this.buildOutput.getModuleOutputs();

        for (var output of outputs) {
            var result = this.parseModuleOutput(output);

            if (result) {
                results.push(result);
            }
        }

        return results;
    }

    private parseModuleOutput(output: ModuleOutput): AnalysisResult {

        let reportDir = this.getBuildReportDir(output);
        let xmlReports = glob.sync(path.join(reportDir, '*.xml'));

        if (xmlReports.length === 0) {
            tl.debug(`[CA] No PMD reports found for the ${output.moduleName} module. Searched in ${reportDir}`);
            return null;
        }

        tl.debug(`[CA] Found ${xmlReports.length} xml reports for module ${output.moduleName}`)
        return this.buildAnalysisResultFromModule(xmlReports, output.moduleName);
    }

    private getBuildReportDir(output: ModuleOutput) {
        switch (this.buildOutput.buildEngine) {
            case BuildEngine.Maven:
                return path.join(output.moduleRoot);
            case BuildEngine.Gradle:
                return path.join(output.moduleRoot, 'reports', 'pmd');
            default:
                throw new Error('not supported');
        }
    }

    private buildAnalysisResultFromModule(xmlReports: string[], moduleName: string): AnalysisResult {

        let analysisResult: AnalysisResult = null;
        let fileCount: number = 0;
        let violationCount: number = 0;
        let artifacts: string[] = [];

        for (var xmlReport of xmlReports) {

            var pmdXmlFileContents = fs.readFileSync(xmlReport, 'utf-8');
            var result = this.parseXmlReport(pmdXmlFileContents, xmlReport, moduleName);

            if (result) {
                violationCount += result[0];
                fileCount += result[1];
                artifacts.push(xmlReport);
                var htmlReport = this.findHtmlReport(xmlReport);

                if (htmlReport) {
                    artifacts.push(htmlReport);
                }
            }
        }

        return new AnalysisResult(PmdTool.Name, moduleName, artifacts, violationCount, fileCount);
    }

    private findHtmlReport(xmlReport: string): string {

        // expecting to find an html report with the same name
        var reportName = path.basename(xmlReport, '.xml');
        var dirName = path.dirname(xmlReport);

        var htmlReports = glob.sync(path.join(dirName, '**', reportName + '.html'));

        if (htmlReports.length > 0) {
            return htmlReports[0];
        }

        return null;
    }

    private parseXmlReport(pmdXmlFileContents: string, xmlReport: string, moduleName: string) {

        let fileCount = 0;
        let violationCount = 0;

        xml2js.parseString(pmdXmlFileContents, (err, data) => {
            // If the file is not XML, or is not from PMD, return immediately
            if (!data || !data.pmd) { 
                tl.debug(`[CA] Empty or unrecognized PMD xml report ${xmlReport}`);
                return null;
            }

            if (!data.pmd.file || data.pmd.file.length === 0) { // No files with violations, return now that it has been marked for upload
                tl.debug(`[CA] A pmd report was found for module '${moduleName}' but it contains no violations`);
                return null;
            }

            fileCount = data.pmd.file.length;
            data.pmd.file.forEach((file: any) => {
                if (file.violation) {
                    violationCount += file.violation.length;
                }
            });

            tl.debug(`[CA] A PMD report was found for for module '${moduleName}' containing ${violationCount} issues - ${xmlReport}`);
        });

        return [violationCount, fileCount];
    }

}

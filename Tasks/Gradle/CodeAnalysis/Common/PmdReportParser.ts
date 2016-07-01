import {AnalysisResult} from './AnalysisResult'
import {IAnalysisToolReportParser} from './IAnalysisToolReportParser'
import {BuildOutput} from './BuildOutput'
import {ModuleOutput} from './ModuleOutput'

import path = require('path');
import fs = require('fs');
import glob = require('glob');
import xml2js = require('xml2js');

import tl = require('vsts-task-lib/task');


/**
 * An object that is able to identify and parse PMD reports
 * 
 * @export
 * @class PmdReportParser
 * @implements {IAnalysisToolReportParser}
 */
export class PmdReportParser implements IAnalysisToolReportParser {

    constructor(private buildOutput: BuildOutput) {

    }

    public parse(): AnalysisResult[] {
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

        let reportDir = path.join(output.moduleRoot, 'reports', 'pmd');
        let xmlReports = glob.sync(path.join(reportDir, '*.xml'));
        let htmlReports = glob.sync(path.join(reportDir, '*.html'));

        if (xmlReports.length === 0 || htmlReports.length === 0) {
            tl.debug(`[CA] No PMD reports found for the ${output.moduleName} module. Searched in ${output.moduleRoot}`);
            return null;
        }

        if (xmlReports.length > 1 || htmlReports.length > 1) {
            tl.debug(`[CA] Found multiple PMD reports in ${reportDir} - skipping them`);
            return null;
        }

        return this.buildAnalysisResult(xmlReports[0], htmlReports[0], output.moduleName);

    }

    private buildAnalysisResult(xmlReport: string, htmlReport: string, moduleName: string): AnalysisResult {

        let analysisResult: AnalysisResult = null;

        var pmdXmlFileContents = fs.readFileSync(xmlReport, 'utf-8');
        xml2js.parseString(pmdXmlFileContents, (err, data) => {
            if (!data || !data.pmd) { // If the file is not in XML, or is from PMD, return immediately
                tl.debug(`[CA] Empty or unrecognized PMD xml report ${xmlReport}`);
                return null;
            }

            if (!data.pmd.file || data.pmd.file.length === 0) { // No files with violations, return now that it has been marked for upload
                tl.debug(`[CA] A pmd report was found for module '${moduleName}' but it contains no violations`);
                return null;
            }

            let fileCount: number = data.pmd.file.length;
            let violationCount: number = 0;

            data.pmd.file.forEach((file: any) => {
                if (file.violation) {
                    violationCount += file.violation.length;
                }
            });

            tl.debug(`[CA] A pmd report was found for for module '${moduleName}' containing ${violationCount} issues`);
            analysisResult = new AnalysisResult('PMD', moduleName, [xmlReport, htmlReport], violationCount, fileCount);
        });
        return analysisResult;
    }
}

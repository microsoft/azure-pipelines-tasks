import {AnalysisResult} from './AnalysisResult'
import {IAnalysisTool} from './IAnalysisTool'
import {BuildOutput, BuildEngine} from './BuildOutput'
import {ModuleOutput} from './ModuleOutput'
import {ToolRunner} from 'vsts-task-lib/toolrunner';
import {BaseTool} from './BaseTool'

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
export class CheckstyleTool extends BaseTool {

    constructor(buildOutput: BuildOutput, boolInputName: string) {
        super('Checkstyle', buildOutput, boolInputName);
    }

    public configureBuild(toolRunner: ToolRunner): ToolRunner {
        if (this.isEnabled()) {
            console.log(tl.loc('codeAnalysis_ToolIsEnabled'), this.toolName);

            switch (this.buildOutput.buildEngine) {
                case BuildEngine.Maven: {
                    toolRunner.arg(['checkstyle:checkstyle']);
                    break;
                }
                case BuildEngine.Gradle: {
                    var initScriptPath: string = path.join(__dirname, '..', 'checkstyle.gradle');
                    toolRunner.arg(['-I', initScriptPath]);
                    break;
                }
            }
        }
        return toolRunner;
    }

    /**
    * Implementers must specify where the XML reports are located
    */
    protected getBuildReportDir(output: ModuleOutput) {

        switch (this.buildOutput.buildEngine) {
            case BuildEngine.Maven:
                return path.join(output.moduleRoot);
            case BuildEngine.Gradle:
                return path.join(output.moduleRoot, 'reports', 'checkstyle');
            default:
                tl.debug('No such build engine ' + this.buildOutput.buildEngine);
                throw new Error();
        }
    }

    /**
    * Report parser that extracts the number of affected files and the number of violations from a report
    *
    * @returns a tuple of [affected_file_count, violation_count]
    */
    protected parseXmlReport(xmlReport: string, moduleName: string): [number, number] {
        let fileCount = 0;
        let violationCount = 0;

        var reportContent = fs.readFileSync(xmlReport, 'utf-8');
        xml2js.parseString(reportContent, (err, data) => {
            // If the file is not XML, or is not from checkstyle, return immediately
            if (!data || !data.checkstyle) {
                tl.debug(`[CA] Empty or unrecognized checkstyle xml report ${xmlReport}`);
                return null;
            }

            // No files with violations, return now that it has been marked for upload
            if (!data.checkstyle.file || data.checkstyle.file.length === 0) {
                tl.debug(`[CA] A checkstyle report was found for module '${moduleName}' but it contains no violations`);
                return null;
            }

            data.checkstyle.file.forEach((file: any) => {
                if (file.error) {
                    fileCount++;
                    violationCount += file.error.length;
                }
            });

            tl.debug(`[CA] A checkstyle report was found for for module '${moduleName}' containing ${violationCount} issues - ${xmlReport}`);
        });

        return [violationCount, fileCount];
    }
}

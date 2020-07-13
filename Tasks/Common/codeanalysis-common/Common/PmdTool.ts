import { BuildOutput, BuildEngine } from './BuildOutput';
import { ModuleOutput } from './ModuleOutput';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { BaseTool } from './BaseTool';

import path = require('path');
import fs = require('fs');
import xml2js = require('xml2js');

import * as tl from 'azure-pipelines-task-lib/task';

/**
 * An object that is able to configure the build to run PMD and identify and parse PMD reports
 *
 * @export
 * @class PmdReportParser
 * @implements {IAnalysisToolReportParser}
 */
export class PmdTool extends BaseTool {
    constructor(buildOutput: BuildOutput, boolInputName: string) {
        super('PMD', buildOutput, boolInputName);
    }

    /**
     * Configures the provided ToolRunner instance with arguments which will invoke the tool represented by this class.
     * @param toolRunner
     * @returns {ToolRunner} ToolRunner instance with arguments applied
     */
    public configureBuild(toolRunner: ToolRunner): ToolRunner {
        if (this.isEnabled()) {
            console.log(tl.loc('codeAnalysis_ToolIsEnabled'), this.toolName);

            switch (this.buildOutput.buildEngine) {
                case BuildEngine.Maven:
                    toolRunner.arg(['pmd:pmd']);
                    break;
                case BuildEngine.Gradle:
                    let initScriptPath: string = path.join(__dirname, '..', 'pmd.gradle');
                    toolRunner.arg(['-I', initScriptPath]);
                    break;
                default:
                    break;
            }
        }
        return toolRunner;
    }

    /**
     * Implementers must specify where the XML reports are located
     */
    protected getBuildReportDir(output: ModuleOutput): string {
        switch (this.buildOutput.buildEngine) {
            case BuildEngine.Maven:
                return path.join(output.moduleRoot);
            case BuildEngine.Gradle:
                return path.join(output.moduleRoot, 'reports', 'pmd');
            default:
                throw new Error('No such build engine ' + this.buildOutput.buildEngine);
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

        let reportContent: string = fs.readFileSync(xmlReport, 'utf-8');
        xml2js.parseString(reportContent, (err, data) => {
            // If the file is not XML, or is not from PMD, return immediately
            if (!data || !data.pmd) {
                tl.debug(`[CA] Empty or unrecognized PMD xml report ${xmlReport}`);
                return null;
            }

            if (!data.pmd.file || data.pmd.file.length === 0) { // No files with violations, return now that it has been marked for upload
                tl.debug(`[CA] A PMD report was found for module '${moduleName}' but it contains no violations`);
                return null;
            }

            data.pmd.file.forEach((file: any) => {
                if (file.violation) {
                    fileCount++;
                    violationCount += file.violation.length;
                }
            });

            tl.debug(`[CA] A PMD report was found for for module '${moduleName}' containing ${violationCount} issues - ${xmlReport}`);
        });

        return [violationCount, fileCount];
    }
}

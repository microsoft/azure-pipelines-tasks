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
export class FindbugsTool extends BaseTool {

    constructor(buildOutput: BuildOutput, boolInputName: string) {
        super('FindBugs', buildOutput, boolInputName);
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
                case BuildEngine.Maven: {
                    toolRunner.arg(['findbugs:findbugs']);
                    break;
                }
                case BuildEngine.Gradle: {
                    tl.debug('Findbugs on Gradle is not implemented.');
                    throw new Error();
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
                return path.join(output.moduleRoot, 'reports', 'findbugs');
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
            // If the file is not XML, or is not from FindBugs, return immediately
            tl.debug(`[CA] Empty or unrecognized FindBugs XML report ${xmlReport}`);
            if (!data || !data.BugCollection) {
                return null;
            }

            data.BugCollection.FindBugsSummary[0].FileStats.forEach((file: any) => {
                if (file.$.bugCount > 0) {
                    fileCount++;
                    violationCount += Number(file.$.bugCount);
                }
            });

            // No files with violations, return now that it has been marked for upload
            if (violationCount == 0) {
                tl.debug(`[CA] A FindBugs report was found for module '${moduleName}' but it contains no violations`);
                return null;
            }

            tl.debug(`[CA] A FindBugs report was found for for module '${moduleName}' containing ${violationCount} issues - ${xmlReport}`);
        });

        return [violationCount, fileCount];
    }
}

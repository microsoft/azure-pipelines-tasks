import { BuildOutput, BuildEngine } from './BuildOutput';
import { ModuleOutput } from './ModuleOutput';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { BaseTool } from './BaseTool';

import path = require('path');
import fs = require('fs');
import xml2js = require('xml2js');

import * as tl from 'azure-pipelines-task-lib/task';

/**
 * An object that is able to configure the build to run FindBugs and identify and parse FindBugs reports
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
                case BuildEngine.Maven:
                    toolRunner.arg(['findbugs:findbugs']);
                    break;
                case BuildEngine.Gradle:
                    let initScriptPath: string = path.join(__dirname, '..', 'findbugs.gradle');
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
        let jsonCounts:[number, number] = [0, 0];

        let reportContent: string = fs.readFileSync(xmlReport, 'utf-8');
        xml2js.parseString(reportContent, (err, data) => {
            jsonCounts = FindbugsTool.parseJson(data);
            if (jsonCounts == null) {
                tl.debug(`[CA] Empty or unrecognized FindBugs XML report ${xmlReport}`);
                return null;
            }

            let violationCount: number = jsonCounts[1];

            // No files with violations, return now that it has been marked for upload
            if (violationCount === 0) {
                tl.debug(`[CA] A FindBugs report was found for module '${moduleName}' but it contains no violations`);
                return null;
            }

            tl.debug(`[CA] A FindBugs report was found for for module '${moduleName}' containing ${violationCount} issues - ${xmlReport}`);
        });

        return jsonCounts;
    }

    /**
     * Extracts the number of affected files and the number of violations from a report JSON object
     * @param data JSON object to parse
     * @returns a tuple of [affected_file_count, violation_count]
     */
    private static parseJson(data: any): [number, number] {
        // If the file is not XML, or is not from FindBugs, return immediately
        if (!data || !data.BugCollection ||
            !data.BugCollection.FindBugsSummary || !data.BugCollection.FindBugsSummary[0] ||
            !data.BugCollection.FindBugsSummary[0].PackageStats ||
            !data.BugCollection.FindBugsSummary[0].PackageStats[0].ClassStats) {
            return null;
        }

        let fileCount: number = 0;
        let violationCount: number = 0;

        // Extract violation and file count data from the sourceFile attribute of ClassStats
        let filesToViolations: Map<string, number> = new Map(); // Maps files -> number of violations
        data.BugCollection.FindBugsSummary[0].forEach((packageStats: any) => packageStats.ClassStats.forEach((classStats:any) => {
            // The below line takes the sourceFile attribute of the classStats tag - it looks like this in the XML
            // <ClassStats class="main.java.TestClassWithErrors" sourceFile="TestClassWithErrors.java" ... />
            let sourceFile: string = classStats.$.sourceFile;
            let newBugCount: number = Number(classStats.$.bugs);
            if (newBugCount > 0) {
                // If there was not already an entry, start at 0
                if (!filesToViolations.has(sourceFile)) {
                    filesToViolations.set(sourceFile, 0);
                }

                // Increment bug count
                let oldBugCount: number = filesToViolations.get(sourceFile);
                filesToViolations.set(sourceFile, oldBugCount + newBugCount);
            }
        }));

        // Sum violations across all files for violationCount
        for (let violations of filesToViolations.values()) {
            violationCount += violations;
        }

        // Number of <K,V> pairs in filesToViolations is fileCount
        fileCount = filesToViolations.size;

        return [fileCount, violationCount];
    }
}

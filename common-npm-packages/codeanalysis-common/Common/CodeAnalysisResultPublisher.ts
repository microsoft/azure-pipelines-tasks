import { AnalysisResult } from './AnalysisResult';
import { FileSystemInteractions } from './FileSystemInteractions';

import path = require('path');
import fs = require('fs');

import * as tl from 'azure-pipelines-task-lib/task';;

export class CodeAnalysisResultPublisher {
    constructor(private analysisResults: AnalysisResult[], private stagingDir: string) {
        if (!analysisResults) {
            throw new ReferenceError('analysisResults');
        }

        if (!stagingDir) {
            throw new ReferenceError('stagingDir');
        }
    }

    /**
     * Uploads the artifacts. It groups them by module
     *
     * @param {string} prefix - used to discriminate between artifacts comming from different builds of the same projects (e.g. the build number)
     */
    public uploadArtifacts(prefix: string): number {
        // If there are no results to upload, return
        if (this.analysisResults.length === 0) {
            tl.debug('[CA] Skipping artifact upload: No analysis results');
            return;
        }

        // If there are no files to upload, return
        let analysisResultsWithFiles: AnalysisResult[] = this.analysisResults.filter(
            (analysisResult:AnalysisResult) => {
                return analysisResult.resultFiles !== undefined && analysisResult.resultFiles !== null && analysisResult.resultFiles.length > 0;
        });
        if (analysisResultsWithFiles.length === 0) {
            tl.debug('[CA] Skipping artifact upload: No files to upload');
            return;
        }

        tl.debug('[CA] Preparing to upload artifacts');

        let artifactBaseDir: string = path.join(this.stagingDir, 'CA');
        FileSystemInteractions.createDirectory(artifactBaseDir);

        for (let analysisResult of analysisResultsWithFiles) {

            // Group artifacts in folders representing the module name
            let destinationDir: string = path.join(artifactBaseDir, analysisResult.moduleName);
            FileSystemInteractions.createDirectory(destinationDir);

            for (let resultFile of analysisResult.resultFiles) {
                let extension: string = path.extname(resultFile);
                let reportName: string = path.basename(resultFile, extension);

                let artifactName: string = `${prefix}_${reportName}_${analysisResult.originatingTool.toolName}${extension}`;
                FileSystemInteractions.copyFile(resultFile, path.join(destinationDir, artifactName));
            }
        }

        tl.command('artifact.upload',
                   { 'artifactname': tl.loc('codeAnalysisArtifactSummaryTitle') },
                   artifactBaseDir);
        return analysisResultsWithFiles.length;
    }

    /**
     * Creates and uploads a build summary that looks like:
     * Looks like:  PMD found 13 violations in 4 files.
     *              FindBugs found 10 violations in 8 files.
     *
     * Code analysis results can be found in the 'Artifacts' tab.
     */
    public uploadBuildSummary(uploadedArtifacts: number): void {
        if (this.analysisResults.length === 0) {
            return;
        }

        tl.debug('[CA] Preparing a build summary');
        let content: string = this.createSummaryContent(uploadedArtifacts);
        this.uploadMdSummary(content);
    }

    private groupBy(array: any, f: Function): any[] {
        let groups: any = {};
        array.forEach((o: any) => {
            let group: string = JSON.stringify(f(o));
            groups[group] = groups[group] || [];
            groups[group].push(o);
        });
        return Object.keys(groups).map((group) => {
            return groups[group];
        });
    }

    private uploadMdSummary(content: string): void {
        let buildSummaryFilePath: string = path.join(this.stagingDir, 'CodeAnalysisBuildSummary.md');
        FileSystemInteractions.createDirectory(this.stagingDir);
        fs.writeFileSync(buildSummaryFilePath, content);

        tl.debug('[CA] Uploading build summary from ' + buildSummaryFilePath);

        tl.command('task.addattachment',
                   {
                       'type': 'Distributedtask.Core.Summary',
                       'name': tl.loc('codeAnalysisBuildSummaryTitle')
                   },
                   buildSummaryFilePath);
    }

    private createSummaryContent(uploadedArtifacts: number): string {
        let buildSummaryLines: string[] = [];
        let resultsGroupedByTool: AnalysisResult[][] =
            this.groupBy(this.analysisResults, (o: AnalysisResult) => { return o.originatingTool.toolName; });

        for (let resultGroup of resultsGroupedByTool) {
            let summaryLine = this.createSummaryLine(resultGroup);
            if (summaryLine != null) {
                buildSummaryLines.push(summaryLine);
            }
        }

        if (buildSummaryLines.length > 0 && uploadedArtifacts > 0) { // Do not print this last line if there were no results uploaded
            buildSummaryLines.push('');
            buildSummaryLines.push('Code analysis results can be found in the \'Artifacts\' tab.');
        }

        let buildSummaryString: string = buildSummaryLines.join('  \r\n');
        tl.debug(`[CA] Build Summary: ${buildSummaryString}`);
        return buildSummaryString;
    }

    // For a given code analysis tool, create a one-line summary from multiple AnalysisResult objects.
    private createSummaryLine(analysisResultsGroup: AnalysisResult[]): string {
        let violationCount: number = 0;
        let affectedFileCount: number = 0;
        let toolName = analysisResultsGroup[0].originatingTool.toolName;

        analysisResultsGroup.forEach((analysisResult: AnalysisResult) => {
            violationCount += analysisResult.violationCount;
            affectedFileCount += analysisResult.affectedFileCount;
        });

        if (violationCount > 1) {
            if (affectedFileCount > 1) {
                // Looks like: 'PMD found 13 violations in 4 files.'
                return tl.loc('codeAnalysisBuildSummaryLine_SomeViolationsSomeFiles', toolName, violationCount, affectedFileCount);
            }
            if (affectedFileCount === 1) {
                // Looks like: 'PMD found 13 violations in 1 file.'
                return tl.loc('codeAnalysisBuildSummaryLine_SomeViolationsOneFile', toolName, violationCount);
            }
        }
        if (violationCount === 1 && affectedFileCount === 1) {
            // Looks like: 'PMD found 1 violation in 1 file.'
            return tl.loc('codeAnalysisBuildSummaryLine_OneViolationOneFile', toolName);
        }
        if (violationCount === 0) {
            // Tools produce an AnalysisResult regardless of whether they were enabled through the UI or not
            // Therefore, only show "X did not find any violations" messages if the tool was enabled
            if (!analysisResultsGroup[0].originatingTool.isEnabled()) {
                return null;
            }

            // Looks like: 'PMD found no violations.'
            return tl.loc('codeAnalysisBuildSummaryLine_NoViolations', toolName);
        }

        // There should be no valid code reason to reach this point - '1 violation in 4 files' is not expected
        throw new Error('Unexpected results from ' + toolName + ': '
            + violationCount + ' total violations in ' + affectedFileCount + ' files');
    }
}

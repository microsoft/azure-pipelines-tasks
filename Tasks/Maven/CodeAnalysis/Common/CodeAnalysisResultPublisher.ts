import {AnalysisResult} from './AnalysisResult'
import {FileSystemInteractions} from './FileSystemInteractions';

import path = require('path');
import fs = require('fs');
import glob = require('glob');

import tl = require('vsts-task-lib/task');


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
    public uploadArtifacts(prefix: string):void {
        if (this.analysisResults.length === 0) {
            return;
        }

        tl.debug('[CA] Preparing to upload artifacts');

        let artifactBaseDir = path.join(this.stagingDir, 'CA');
        FileSystemInteractions.createDirectory(artifactBaseDir);

        for (var analysisResult of this.analysisResults) {

            // Group artifacts in folders representing the module name
            let destinationDir = path.join(artifactBaseDir, analysisResult.moduleName);
            FileSystemInteractions.createDirectory(destinationDir);

            for (var resultFile of analysisResult.resultFiles) {
                let extension = path.extname(resultFile);
                let reportName = path.basename(resultFile, extension);

                let artifactName = `${prefix}_${reportName}_${analysisResult.originatingTool.toolName}${extension}`;
                FileSystemInteractions.copyFile(resultFile, path.join(destinationDir, artifactName));
            }
        }

        tl.command("artifact.upload", {
            'artifactname': tl.loc('codeAnalysisArtifactSummaryTitle')
        }, artifactBaseDir);
    }


    /**
     * Creates and uploads a build summary that looks like:
     * Looks like:  PMD found 13 violations in 4 files.
     *              FindBugs found 10 violations in 8 files.
     *
     * Code analysis results can be found in the 'Artifacts' tab.
     */
    public uploadBuildSummary():void {

        if (this.analysisResults.length === 0) {
            return;
        }

        tl.debug('[CA] Preparing a build summary');
        let content: string = this.createSummaryContent();
        this.uploadMdSummary(content);
    }

    private groupBy(array: any, f: Function):any[] {
        var groups: any = {};
        array.forEach((o: any) => {
            var group = JSON.stringify(f(o));
            groups[group] = groups[group] || [];
            groups[group].push(o);
        });
        return Object.keys(groups).map((group) => {
            return groups[group];
        });
    }

    private uploadMdSummary(content: string):void {
        var buildSummaryFilePath: string = path.join(this.stagingDir, 'CodeAnalysisBuildSummary.md');
        FileSystemInteractions.createDirectory(this.stagingDir);
        fs.writeFileSync(buildSummaryFilePath, content);

        tl.debug('[CA] Uploading build summary from ' + buildSummaryFilePath);

        tl.command('task.addattachment', {
            'type': 'Distributedtask.Core.Summary',
            'name': tl.loc('codeAnalysisBuildSummaryTitle')
        }, buildSummaryFilePath);
    }

    private createSummaryContent(): string {

        var buildSummaryLines: string[] = [];
        var resultsGroupedByTool: AnalysisResult[][] =
            this.groupBy(this.analysisResults, (o: AnalysisResult) => { return o.originatingTool.toolName; });

        for (var resultGroup of resultsGroupedByTool) {
            var summaryLine = this.createSummaryLine(resultGroup);
            if (summaryLine != null) {
                buildSummaryLines.push(summaryLine);
            }
        }

        if (buildSummaryLines.length > 0) {
            buildSummaryLines.push('');
            buildSummaryLines.push('Code analysis results can be found in the \'Artifacts\' tab.');
        }

        var buildSummaryString = buildSummaryLines.join('  \r\n');
        tl.debug(`[CA] Build Summary: ${buildSummaryString}`);
        return buildSummaryString;
    }

    // For a given code analysis tool, create a one-line summary from multiple AnalysisResult objects.
    private createSummaryLine(analysisResultsGroup: AnalysisResult[]): string {
        var violationCount: number = 0;
        var affectedFileCount: number = 0;
        var toolName = analysisResultsGroup[0].originatingTool.toolName;

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

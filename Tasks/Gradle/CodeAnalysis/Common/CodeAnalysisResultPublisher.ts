import {AnalysisResult} from './AnalysisResult'

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
     * Uploads the artifacts. It groups them into logical artifact directories 
     * 
     * @param {string} prefix
     */
    public uploadArtifacts(prefix: string) {
        tl.debug('[CA] Preparing to upload artifacts');
        for (var analysisResult of this.analysisResults) {
            let destinationDir = path.join(this.stagingDir, `${analysisResult.toolName}`);

            for (var resultFile of analysisResult.resultFiles) {
                let extension = path.extname(resultFile);
                let artifactName = `${prefix}_${analysisResult.moduleName}_${analysisResult.toolName}${extension}`;

                tl.mkdirP(destinationDir);
                tl.cp('-f', resultFile, path.join(destinationDir, artifactName));
            }

            tl.debug(`[CA] Uploading artifacts for ${analysisResult.moduleName} module - ${destinationDir}`);

            // Artifact upload is a fire and forget operation 
            tl.command("artifact.upload", {
                'containerfolder': analysisResult.moduleName,
                // Artifact names need to be unique on an upload-by-upload basis
                'artifactname': `${prefix}_${analysisResult.moduleName}_${analysisResult.toolName}`
            }, destinationDir);
        }
    }

    /**
     * Creates and uploads a build summary that looks like:
     * Looks like:  PMD found 13 violations in 4 files.  
     *              FindBugs found 10 violations in 8 files.  
     *   
     * Code analysis results can be found in the 'Artifacts' tab. 
     */
    public uploadBuildSummary() {
        tl.debug('[CA] Preparing a build summary');
        let content: string = this.createSummaryContent();
        this.uploadMdSummary(content);
    }

    private groupBy(array: any, f: Function) {
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

    private uploadMdSummary(content: string) {
        var buildSummaryFilePath: string = path.join(this.stagingDir, 'CodeAnalysisBuildSummary.md');
        tl.mkdirP(this.stagingDir);
        fs.writeFileSync(buildSummaryFilePath, content);

        tl.debug('[CA] Uploading build summary from ' + buildSummaryFilePath);

        tl.command('task.addattachment', {
            'type': 'Distributedtask.Core.Summary',
            'name': tl.loc('codeAnalysisBuildSummaryTitle')
        }, buildSummaryFilePath);
    }

    private createSummaryContent(): string {

        var buildSummaryLines: string[] = [];
        var resultsGroupedByTool: AnalysisResult[][] = this.groupBy(this.analysisResults, (o: AnalysisResult) => { return o.toolName; });

        for (var resultGroup of resultsGroupedByTool) {
            var summaryLine = this.createSummaryLine(resultGroup);
            buildSummaryLines.push(summaryLine);
        }

        tl.debug(`[CA] Build Summary: ${buildSummaryLines}`);

        if (buildSummaryLines.length > 0) {
            buildSummaryLines.push('');
            buildSummaryLines.push('Code analysis results can be found in the \'Artifacts\' tab.');
        }

        return buildSummaryLines.join('  \r\n');
    }

    // For a given code analysis tool, create a one-line summary from multiple AnalysisResult objects.
    private createSummaryLine(analysisResultsGroup: AnalysisResult[]): string {
        var violationCount: number = 0;
        var affectedFileCount: number = 0;
        var toolName = analysisResultsGroup[0].toolName;

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
            // Looks like: 'PMD found no violations.'
            return tl.loc('codeAnalysisBuildSummaryLine_NoViolations', toolName);
        }

        // There should be no valid code reason to reach this point - '1 violation in 4 files' is not expected
        throw new Error('Unexpected results from ' + toolName + ': '
            + violationCount + ' total violations in ' + affectedFileCount + ' files');
    }

}

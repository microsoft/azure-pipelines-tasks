/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />

import path = require('path');
import fs = require('fs');

import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

// Lowercased names are to lessen the likelihood of xplat issues
import pmd = require('./pmdformaven');
import ar = require('./analysisresult');
import ma = require('./moduleanalysis');

// Set up for localization
tl.setResourcePath(path.join( __dirname, 'task.json'));

// Cache build variables - if they are null, we are in a test env and can use test inputs
// The artifact staging directory will be a subdirectory just to be safe.
var sourcesDir:string = tl.getVariable('build.sourcesDirectory') || tl.getInput('test.sourcesDirectory');
var stagingDir:string = path.join(tl.getVariable('build.artifactStagingDirectory') || tl.getInput('test.artifactStagingDirectory'), ".codeAnalysis");
var buildNumber:string = tl.getVariable('build.buildNumber') || tl.getInput('test.buildNumber');

// Returns the names of any enabled code analysis tools, or empty array if none.
function getEnabledCodeAnalysisTools():string[] {
    var result:string[] = [];

    if (tl.getInput('pmdAnalysisEnabled', true) == 'true') {
        console.log('PMD analysis is enabled');
        result.push(pmd.toolName);
    }

    return result;
}

// Returns the full path of the staging directory for a given tool.
function getStagingDirectory(toolName:string):string {
    return path.join(stagingDir, toolName.toLowerCase());
}

function cleanDirectory(targetDirectory:string):boolean {
    tl.rmRF(targetDirectory);
    tl.mkdirP(targetDirectory);

    return tl.exist(targetDirectory);
}

// Apply goals for enabled code analysis tools
export function applyEnabledCodeAnalysisGoals(mvnRun: trm.ToolRunner):void {
    var enabledCodeAnalysisTools:string[] = getEnabledCodeAnalysisTools();

    // PMD
    if (enabledCodeAnalysisTools.indexOf(pmd.toolName) > -1) {
        pmd.applyPmdArgs(mvnRun);
    }
}

// Identifies maven modules below the root by the presence of a pom.xml file and a /target/ directory,
// which is the conventional format of a Maven module.
// There is a possibility of both false positives if the above two factors are identified in a directory
// that is not an actual Maven module, or if the module is not currently being built.
// The possibility of false positives should be taken into account when this method is called.
function findCandidateModules(directory:string):ma.ModuleAnalysis[] {
    var result:ma.ModuleAnalysis[] = [];
    var filesInDirectory:string[] = fs.readdirSync(directory);

    // Look for pom.xml and /target/
    if ((filesInDirectory.indexOf('pom.xml') > -1) && (filesInDirectory.indexOf('target') > -1)) {
        var newModule:ma.ModuleAnalysis = new ma.ModuleAnalysis();
        newModule.moduleName = path.basename(directory);
        newModule.rootDirectory = directory;
        result.push(newModule);
    }

    // Search subdirectories
    filesInDirectory.forEach(function(fileInDirectory:string) {
        if (fs.statSync(path.join(directory, fileInDirectory)).isDirectory()) {
            result = result.concat(findCandidateModules(path.join(directory, fileInDirectory)));
        }
    });

    return result;
}

// For a given code analysis tool, create a one-line summary from multiple AnalysisResult objects.
function createSummaryLine(toolName:string, analysisResults:ar.AnalysisResult[]):string {
    var totalViolations:number = 0;
    var filesWithViolations:number = 0;
    analysisResults.forEach((analysisResult:ar.AnalysisResult) => {
        if (toolName = analysisResult.toolName) {
            totalViolations += analysisResult.totalViolations;
            filesWithViolations += analysisResult.filesWithViolations;
        }
    });
    // Localize and inject appropriate parameters
    if (totalViolations > 1) {
        if (filesWithViolations > 1) {
            // Looks like: 'PMD found 13 violations in 4 files.'
            return tl.loc('codeAnalysisBuildSummaryLine_SomeViolationsSomeFiles', toolName, totalViolations, filesWithViolations);
        }
        if (filesWithViolations == 1) {
            // Looks like: 'PMD found 13 violations in 1 file.'
            return tl.loc('codeAnalysisBuildSummaryLine_SomeViolationsOneFile', toolName, totalViolations);
        }
    }
    if (totalViolations == 1 && filesWithViolations == 1) {
        // Looks like: 'PMD found 1 violation in 1 file.'
        return tl.loc('codeAnalysisBuildSummaryLine_OneViolationOneFile', toolName);
    }
    if (totalViolations == 0) {
        // Looks like: 'PMD found no violations.'
        return tl.loc('codeAnalysisBuildSummaryLine_NoViolations', toolName);
    }
    // There should be no valid code reason to reach this point - '1 violation in 4 files' is not expected
    throw new Error('Unexpected results from ' + toolName + ': '
        + totalViolations + 'total violations in ' + filesWithViolations + ' files');
}

// Copy output files to a staging directory and upload them as build artifacts.
// Each tool-module combination uploads its own build artifact.
function uploadBuildArtifacts(toolName:string, moduleAnalysis:ma.ModuleAnalysis):void {
    // The staging directory is used as a place to copy files before group uploading them, and was originally
    // related to the following bug: https://github.com/Microsoft/vso-agent/issues/263
    var localStagingDir:string = path.join(getStagingDirectory(toolName), moduleAnalysis.moduleName);
    tl.mkdirP(localStagingDir);

    var filesToUpload:string[] = [];
    if (moduleAnalysis.analysisResults[toolName]) {
        filesToUpload = moduleAnalysis.analysisResults[toolName].filesToUpload;
    }

    if (filesToUpload.length < 1) {
        console.log('No artifacts to upload for ' + toolName + ' analysis of module ' + moduleAnalysis.moduleName);
        return;
    }

    // Copy files to a staging directory so that they can all be uploaded at once
    // This gives us a single artifact with all relevant files grouped together,
    // giving a more organised experience in the artifact explorer.
    filesToUpload.forEach((fileToUpload:string) => {
        var stagingFilePath = path.join(localStagingDir, path.basename(fileToUpload));
        tl.debug('Staging ' + fileToUpload + ' to ' + stagingFilePath);
        // Execute the copy operation. -f overwrites if there is already a file at the destination.
        tl.cp('-f', fileToUpload, stagingFilePath);
    });

    console.log('Uploading artifacts for ' + toolName + ' from ' + localStagingDir);

    // Begin artifact upload - this is an asynchronous operation and will finish in the future
    tl.command("artifact.upload", {
        // Put the artifacts in subdirectories corresponding to their module
        containerfolder: moduleAnalysis.moduleName,
        // Prefix the build number onto the upload for convenience
        // NB: Artifact names need to be unique on an upload-by-upload basis
        artifactname: buildNumber + '_' + moduleAnalysis.moduleName + '_' + toolName
    }, localStagingDir);
}

// Extract data from code analysis output files and upload results to build server
export function uploadCodeAnalysisResults():void {
    // Need to run this if any one of the code analysis tools were run
    var enabledCodeAnalysisTools = getEnabledCodeAnalysisTools();
    if (enabledCodeAnalysisTools.length > 0) {
        // Discover maven modules
        var modules:ma.ModuleAnalysis[] = findCandidateModules(sourcesDir);

        // Special case: if the root turns up as a module, the automatic name won't do
        modules.forEach((module:ma.ModuleAnalysis) => {
            if (module.rootDirectory == sourcesDir) {
                module.moduleName = 'root';
            }
        });

        tl.debug('Discovered ' + modules.length + ' Maven modules to upload results from.');

        // Discover output files, summarise per-module results
        modules.forEach((module:ma.ModuleAnalysis) => {
            // PMD
            if (enabledCodeAnalysisTools.indexOf(pmd.toolName) > -1) {
                try {
                    var pmdResults:ar.AnalysisResult = pmd.collectPmdOutput(module.rootDirectory);
                    if (pmdResults) {
                        module.analysisResults[pmdResults.toolName] = pmdResults;
                    }
                } catch(e) {
                    tl.error(e.message);
                    tl.exit(1);
                }
            }

        });


        // Gather analysis results by tool for summaries, stage and upload build artifacts
        var buildSummaryLines:string[] = [];
        cleanDirectory(stagingDir);

        enabledCodeAnalysisTools.forEach((toolName:string) => {
            var toolAnalysisResults:ar.AnalysisResult[] = [];
            modules.forEach((module:ma.ModuleAnalysis) => {
                var moduleAnalysisResult:ar.AnalysisResult = module.analysisResults[toolName];
                if (moduleAnalysisResult) {
                    toolAnalysisResults.push(moduleAnalysisResult);
                }

                uploadBuildArtifacts(toolName, module);
            });

            // After looping through all modules, summarise tool output results
            try {
                var summaryLine:string = createSummaryLine(toolName, toolAnalysisResults);
            } catch (error) {
                tl.error(error.message);
            }
            buildSummaryLines.push(summaryLine);
        });

        // Save and upload build summary
        // Looks like: "PMD found 13 violations in 4 files.  \r\n
        // FindBugs found 10 violations in 8 files."
        var buildSummaryContents:string = buildSummaryLines.join("  \r\n"); // Double space is end of line in markdown
        var buildSummaryFilePath:string = path.join(stagingDir, 'CodeAnalysisBuildSummary.md');
        fs.writeFileSync(buildSummaryFilePath, buildSummaryContents);
        tl.debug('Uploading build summary from ' + buildSummaryFilePath);

        tl.command('task.addattachment', {
            'type': 'Distributedtask.Core.Summary',
            'name': "Code Analysis Report"
        }, buildSummaryFilePath);
    }
}
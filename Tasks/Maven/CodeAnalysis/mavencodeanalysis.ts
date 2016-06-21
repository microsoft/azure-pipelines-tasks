/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import fs = require('fs');
import util = require('util');

import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

// Lowercased names are to lessen the likelihood of xplat issues
import {AnalysisResult} from './analysisresult';
import {ModuleAnalysis} from './moduleanalysis';
import pmd = require('./mavenpmd');
import sq = require('./mavensonar');

// Cache build variables are cached globally as they cannot change during the same build.
var sourcesDir:string;
var stagingDir:string;
var buildNumber:string;

// Apply goals for enabled code analysis tools
export function applyEnabledCodeAnalysisGoals(mvnRun: trm.ToolRunner):trm.ToolRunner {
    // PMD
    if (isCodeAnalysisToolEnabled(pmd.toolName)) {
        pmd.applyPmdArgs(mvnRun);
    }

    return mvnRun;
}

// Extract data from code analysis output files and upload results to build server
export function uploadCodeAnalysisResults(): void {
    // Return early if no analysis tools are enabled
    var enabledCodeAnalysisTools: Set<string> = getEnabledCodeAnalysisTools();

    if (enabledCodeAnalysisTools.size < 1) {
        return;
    }

    // Retrieve build variables
    sourcesDir = tl.getVariable('build.sourcesDirectory');
    stagingDir = getCodeAnalysisStagingDirectory();
    buildNumber = tl.getVariable('build.buildNumber');

    // Discover maven modules
    var modules:ModuleAnalysis[] = findCandidateModules(sourcesDir);

    tl.debug('Discovered ' + modules.length + ' Maven modules to upload results from: ');
    modules.forEach((module:ModuleAnalysis) => {
        tl.debug('    ' + module.moduleName);
    });

    // Gather data from enabled tools, add it to the module objects
    modules = processAndAssignAnalysisResults(enabledCodeAnalysisTools, modules);

    // Upload analysis results to the server
    cleanDirectory(stagingDir);

    // Output files as build artifacts
    uploadBuildArtifactsFromModules(enabledCodeAnalysisTools, modules);
    // Analysis summaries
    createAndUploadBuildSummary(enabledCodeAnalysisTools, modules);
}

// Identifies maven modules below the root by the presence of a pom.xml file and a /target/ directory,
// which is the conventional format of a Maven module.
// There is a possibility of both false positives if the above two factors are identified in a directory
// that is not an actual Maven module, or if the module is not currently being built.
// The possibility of false positives should be taken into account when this method is called.
export function findCandidateModules(directory:string):ModuleAnalysis[] {
    var result:ModuleAnalysis[] = [];
    var filesInDirectory:string[] = fs.readdirSync(directory);

    // Look for pom.xml and /target/
    if ((filesInDirectory.indexOf('pom.xml') > -1) && (filesInDirectory.indexOf('target') > -1)) {
        var newModule:ModuleAnalysis = new ModuleAnalysis();
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

    // Special case: if the root turns up as a module, the automatic name won't do
    result.forEach((module:ModuleAnalysis) => {
        if (module.rootDirectory == tl.getVariable('build.sourcesDirectory')) {
            module.moduleName = 'root';
        }
    });

    return result;
}

export function getCodeAnalysisStagingDirectory() {
    var caStagingDir = path.join(tl.getVariable('build.artifactStagingDirectory'), ".codeAnalysis");
    tl.mkdirP(caStagingDir);
    return caStagingDir;
}

// Returns true if the given code analysis tool is enabled
export function isCodeAnalysisToolEnabled(toolName:string): boolean {
    // Get the list of enabled tools, return whether or not toolName is contained in it
    var result = getEnabledCodeAnalysisTools().has(toolName);
    if (result) {
        // Looks like: 'SonarQube analysis is enabled.'
        console.log(tl.loc('codeAnalysis_ToolIsEnabled', toolName));
    }
    return result;
}

// Returns the names of any enabled code analysis tools, or empty array if none.
function getEnabledCodeAnalysisTools(): Set<string> {
    var result: Set<string> = new Set<string>();

    if (tl.getBoolInput('pmdAnalysisEnabled', false)) {
        result.add(pmd.toolName);
    }

    return result;
}

// Returns the full path of the staging directory for a given tool.
function getToolStagingDirectory(toolName:string):string {
    return path.join(stagingDir, toolName.toLowerCase());
}

function cleanDirectory(targetDirectory:string):boolean {
    tl.rmRF(targetDirectory);
    tl.mkdirP(targetDirectory);

    return tl.exist(targetDirectory);
}

// Discover analysis results from enabled tools and associate them with the modules they cameF from
function processAndAssignAnalysisResults(enabledCodeAnalysisTools:Set<string>, modules:ModuleAnalysis[]):ModuleAnalysis[] {
    modules.forEach((module:ModuleAnalysis) => {
        // PMD
        if (enabledCodeAnalysisTools.has(pmd.toolName)) {
            var pmdResults:AnalysisResult = pmd.collectPmdOutput(module.rootDirectory);
            if (pmdResults) {
                module.analysisResultsByToolName.set(pmdResults.toolName, pmdResults);
            }
        }
    });

    return modules;
}

// Create a build summary from the analysis results of modules
function createAndUploadBuildSummary(enabledTools:Set<string>, modules:ModuleAnalysis[]):void {
    var buildSummaryLines:string[] = [];

    enabledTools.forEach((toolName:string) => {
        var toolAnalysisResults:AnalysisResult[] = getToolAnalysisResults(modules, toolName);

        // After looping through all modules, summarise tool output results
        try {
            var summaryLine:string = createSummaryLine(toolName, toolAnalysisResults);
        } catch (error) {
            tl.error(error.message);
        }
        buildSummaryLines.push(summaryLine);
    });

    // Add a double space and a final line with descriptive text, if there were any violations to be reported
    if (getTotalViolationsInModules(modules) > 0) {
        buildSummaryLines.push("");
        buildSummaryLines.push("Code analysis results can be found in the 'Artifacts' tab.");
    }

    // Save and upload build summary
    // Looks like: "PMD found 13 violations in 4 files.  \r\n
    // FindBugs found 10 violations in 8 files.  \r\n
    //   \r\n
    // Code analysis results can be found in the 'Artifacts' tab.  \r\n"
    var buildSummaryContents:string = buildSummaryLines.join("  \r\n"); // Double space is end of line in markdown
    var buildSummaryFilePath:string = path.join(stagingDir, 'CodeAnalysisBuildSummary.md');
    fs.writeFileSync(buildSummaryFilePath, buildSummaryContents);
    tl.debug('Uploading build summary from ' + buildSummaryFilePath);

    tl.command('task.addattachment', {
        'type': 'Distributedtask.Core.Summary',
        'name': "Code Analysis Report"
    }, buildSummaryFilePath);
}

// Returns a list of analysis results that came from this tool.
function getToolAnalysisResults(modules:ModuleAnalysis[], toolName:string):AnalysisResult[] {
    var toolAnalysisResults:AnalysisResult[] = [];

    modules.forEach((module:ModuleAnalysis) => {
        var moduleAnalysisResult:AnalysisResult = module.analysisResultsByToolName.get(toolName);
        if (moduleAnalysisResult) {
            toolAnalysisResults.push(moduleAnalysisResult);
        }
    });

    return toolAnalysisResults;
}

function getTotalViolationsInModules(modules:ModuleAnalysis[]):number {
    var totalViolationsInBuild:number = 0;
    modules.forEach((module:ModuleAnalysis) => {
        for (let analysisResult of module.analysisResultsByToolName.values()) {
            totalViolationsInBuild += analysisResult.totalViolations;
        }
    });
    return totalViolationsInBuild;
}

// For a given code analysis tool, create a one-line summary from multiple AnalysisResult objects.
function createSummaryLine(toolName:string, analysisResults:AnalysisResult[]):string {
    var totalViolations:number = 0;
    var filesWithViolations:number = 0;
    analysisResults.forEach((analysisResult:AnalysisResult) => {
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
        + totalViolations + ' total violations in ' + filesWithViolations + ' files');
}

// Upload build artifacts from all modules
function uploadBuildArtifactsFromModules(enabledTools:Set<string>, modules:ModuleAnalysis[]) {
    enabledTools.forEach((toolName:string) => {
        modules.forEach((module:ModuleAnalysis) => {
            uploadBuildArtifactsFromModule(toolName, module);
        });
    });
}

// Copy output files to a staging directory and upload them as build artifacts.
// Each tool-module combination uploads its own build artifact.
function uploadBuildArtifactsFromModule(toolName:string, moduleAnalysis:ModuleAnalysis):void {
    var analysisResult:AnalysisResult;
    if (moduleAnalysis.analysisResultsByToolName.has(toolName)) {
        analysisResult = moduleAnalysis.analysisResultsByToolName.get(toolName);
    }

    if (!analysisResult) {
        tl.debug(util.format("No analysis result found for %s analysis of %s", toolName, moduleAnalysis.moduleName));
        return;
    }

    // If there are no files to upload or there were no violations, return early
    if (!analysisResult.filesToUpload || analysisResult.filesToUpload.length < 1) {
        console.log('Skipping artifact upload: No artifacts from ' + toolName + ' analysis of module ' + moduleAnalysis.moduleName);
        return;
    }
    if (analysisResult.totalViolations < 1) {
        console.log('Skipping artifact upload: No violations from ' + toolName + ' analysis of module ' + moduleAnalysis.moduleName);
        return;
    }

    // We create a staging directory to copy files to before group uploading them
    var localStagingDir:string = path.join(getToolStagingDirectory(toolName), moduleAnalysis.moduleName);
    tl.mkdirP(localStagingDir);

    // Copy files to a staging directory so that they can all be uploaded at once
    // This gives us a single artifact with all relevant files grouped together,
    // giving a more organised experience in the artifact explorer.
    analysisResult.filesToUpload.forEach((fileToUpload:string) => {
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
        artifactname: generateArtifactName(moduleAnalysis, toolName)
    }, localStagingDir);
}

function generateArtifactName(moduleAnalysis, toolName) {
    return buildNumber + '_' + moduleAnalysis.moduleName + '_' + toolName;
}
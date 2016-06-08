/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import fs = require('fs');

import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

// Lowercased names are to lessen the likelihood of xplat issues
import pmd = require('./mavenpmd');
import {AnalysisResult} from './analysisresult';
import {ModuleAnalysis} from './moduleanalysis';

// Set up for localization
tl.setResourcePath(path.join( __dirname, '../task.json'));

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
export function uploadCodeAnalysisResults():void {
    // Return early if no analysis tools are enabled
    var enabledCodeAnalysisTools = getEnabledCodeAnalysisTools();
    if (enabledCodeAnalysisTools.length < 1) {
        return;
    }

    // Retrieve build variables
    sourcesDir = tl.getVariable('build.sourcesDirectory');
    stagingDir = path.join(tl.getVariable('build.artifactStagingDirectory'), ".codeAnalysis");
    buildNumber = tl.getVariable('build.buildNumber');

    // Discover maven modules
    var modules:ModuleAnalysis[] = findCandidateModules(sourcesDir);

    // Special case: if the root turns up as a module, the automatic name won't do
    modules.forEach((module:ModuleAnalysis) => {
        if (module.rootDirectory == sourcesDir) {
            module.moduleName = 'root';
        }
    });

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

// Returns the names of any enabled code analysis tools, or empty array if none.
function getEnabledCodeAnalysisTools():string[] {
    var result:string[] = [];

    if (tl.getBoolInput('pmdAnalysisEnabled', false)) {
        console.log('PMD analysis is enabled');
        result.push(pmd.toolName);
    }

    return result;
}

// Returns true if the given code analysis tool is enabled
function isCodeAnalysisToolEnabled(toolName:string) {
    // Get the list of enabled tools, return whether or not toolName is contained in it
    return (getEnabledCodeAnalysisTools().indexOf(toolName) > -1);
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

// Identifies maven modules below the root by the presence of a pom.xml file and a /target/ directory,
// which is the conventional format of a Maven module.
// There is a possibility of both false positives if the above two factors are identified in a directory
// that is not an actual Maven module, or if the module is not currently being built.
// The possibility of false positives should be taken into account when this method is called.
function findCandidateModules(directory:string):ModuleAnalysis[] {
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

    return result;
}

// Discover analysis results from enabled tools and associate them with the modules they came from
function processAndAssignAnalysisResults(enabledCodeAnalysisTools:string[], modules:ModuleAnalysis[]):ModuleAnalysis[] {
    modules.forEach((module:ModuleAnalysis) => {
        // PMD
        if (enabledCodeAnalysisTools.indexOf(pmd.toolName) > -1) {
            var pmdResults:AnalysisResult = pmd.collectPmdOutput(module.rootDirectory);
            if (pmdResults) {
                module.analysisResults[pmdResults.toolName] = pmdResults;
            }
        }
    });

    return modules;
}

// Create a build summary from the analysis results of modules
function createAndUploadBuildSummary(enabledTools:string[], modules:ModuleAnalysis[]):void {
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
        var moduleAnalysisResult:AnalysisResult = module.analysisResults[toolName];
        if (moduleAnalysisResult) {
            toolAnalysisResults.push(moduleAnalysisResult);
        }
    });

    return toolAnalysisResults;
}

function getTotalViolationsInModules(modules:ModuleAnalysis[]):number {
    var totalViolationsInBuild:number = 0;
    modules.forEach((module:ModuleAnalysis) => {
        for (var toolName in module.analysisResults) { // The for-in loop gives the keys, not the values
            totalViolationsInBuild += module.analysisResults[toolName].totalViolations;
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
function uploadBuildArtifactsFromModules(enabledTools:string[], modules:ModuleAnalysis[]) {
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
    if (moduleAnalysis.analysisResults[toolName]) {
        analysisResult = moduleAnalysis.analysisResults[toolName];
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
    var localStagingDir:string = path.join(getStagingDirectory(toolName), moduleAnalysis.moduleName);
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
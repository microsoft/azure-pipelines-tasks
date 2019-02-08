import path = require('path');
import tl = require('vsts-task-lib/task');
import ccUtil = require('codecoverage-tools/codecoverageutilities');

// Main entry point of this task.
async function run() {
    try {
        // Initialize localization
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get input values
        var codeCoverageTool = tl.getInput('codeCoverageTool', true);
        var summaryFileLocation = tl.getInput('summaryFileLocation', true);
        var reportDirectory = tl.getInput('reportDirectory');
        var additionalFiles = tl.getInput('additionalCodeCoverageFiles');
        var failIfCoverageIsEmpty: boolean = tl.getBoolInput('failIfCoverageEmpty');
        var workingDirectory: string = tl.getVariable('System.DefaultWorkingDirectory');

        // Resolve the summary file path.
        // It may contain wildcards allowing the path to change between builds, such as for:
        // $(System.DefaultWorkingDirectory)\artifacts***$(Configuration)\testresults\coverage\cobertura.xml
        var resolvedSummaryFile: string = resolvePathToSingleItem(workingDirectory, summaryFileLocation, false);
        if (failIfCoverageIsEmpty && await ccUtil.isCodeCoverageFileEmpty(resolvedSummaryFile, codeCoverageTool)) {
            throw tl.loc('NoCodeCoverage');
        } else if (!tl.exist(resolvedSummaryFile)) {
            tl.warning(tl.loc('NoCodeCoverage'));
        } else {
            // Resolve the report directory.
            // It may contain wildcards allowing the path to change between builds, such as for:
            // $(System.DefaultWorkingDirectory)\artifacts***$(Configuration)\testresults\coverage
            var resolvedReportDirectory: string = resolvePathToSingleItem(workingDirectory, reportDirectory, true);

            // Get any 'Additional Files' to publish as build artifacts
            if (additionalFiles) {
                // Resolve matches of the 'Additional Files' pattern
                var additionalFileMatches: string[] = tl.findMatch(
                    workingDirectory,
                    additionalFiles,
                    { followSymbolicLinks: false, followSpecifiedSymbolicLink: false },
                    { matchBase: true });

                additionalFileMatches = additionalFileMatches.filter(file => pathExistsAsFile(file));
                tl.debug(tl.loc('FoundNMatchesForPattern', additionalFileMatches.length, additionalFiles));
            }

            // Publish code coverage data
            var ccPublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish(codeCoverageTool, resolvedSummaryFile, resolvedReportDirectory, additionalFileMatches);
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

// Resolves the specified path to a single item based on whether it contains wildcards
function resolvePathToSingleItem(workingDirectory:string, pathInput: string, isDirectory: boolean) : string {
    // Default to using the specific pathInput value
    var resolvedPath: string = pathInput;

    if (pathInput) {

        // Find match patterns won't work if the directory has a trailing slash
        if (isDirectory && (pathInput.endsWith('/') || pathInput.endsWith('\\'))) {
            pathInput = pathInput.slice(0, -1);
        }
        // Resolve matches of the pathInput pattern
        var pathMatches: string[] = tl.findMatch(
            workingDirectory,
            pathInput,
            { followSymbolicLinks: false, followSpecifiedSymbolicLink: false });
        tl.debug(tl.loc('FoundNMatchesForPattern', pathMatches.length, pathInput));

        // Were any matches found?
        if (pathMatches.length == 0) {
            resolvedPath = undefined;
        }
        else {
            // Select the path to be used from the matches
            resolvedPath = pathMatches[0];

            // If more than one path matches, use the first and issue a warning
            if (pathMatches.length > 1) {
                tl.warning(tl.loc('MultipleSummaryFilesFound', resolvedPath));
            }
        }
    }

    // Return resolved path
    return resolvedPath;
}

// Gets whether the specified path exists as file.
function pathExistsAsFile(path: string) {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        tl.debug(error);
        return false;
    }
}

run();

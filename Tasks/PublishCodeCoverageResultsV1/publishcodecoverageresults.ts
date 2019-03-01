import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as ccUtil from 'codecoverage-tools/codecoverageutilities';
import * as os from 'os';

// Main entry point of this task.
async function run() {
    try {
        // Initialize localization
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get input values
        const codeCoverageTool = tl.getInput('codeCoverageTool', true);
        const summaryFileLocation = tl.getInput('summaryFileLocation', true);
        const reportDirectory = tl.getInput('reportDirectory');
        const additionalFiles = tl.getInput('additionalCodeCoverageFiles');
        const failIfCoverageIsEmpty: boolean = tl.getBoolInput('failIfCoverageEmpty');
        const workingDirectory: string = tl.getVariable('System.DefaultWorkingDirectory');
        const sourceDirectory: string = tl.getInput('sourceDirectory');
        let autogenerateHtmlReport: boolean = tl.getBoolInput('autogenerateHtmlReport');
        let tempFolder = undefined;

        // Resolve the summary file path.
        // It may contain wildcards allowing the path to change between builds, such as for:
        // $(System.DefaultWorkingDirectory)\artifacts***$(Configuration)\testresults\coverage\cobertura.xml
        const resolvedSummaryFile: string = resolvePathToSingleItem(workingDirectory, summaryFileLocation, false);

        tl.debug('Resolved summary file: ' + resolvedSummaryFile);

        if (failIfCoverageIsEmpty && await ccUtil.isCodeCoverageFileEmpty(resolvedSummaryFile, codeCoverageTool)) {
            throw tl.loc('NoCodeCoverage');
        } else if (!tl.exist(resolvedSummaryFile)) {
            tl.warning(tl.loc('NoCodeCoverage'));
        } else {

            // Ignore Html Report dirs going forward
            if (reportDirectory) {
                // Resolve the report directory.
                // It may contain wildcards allowing the path to change between builds, such as for:
                // $(System.DefaultWorkingDirectory)\artifacts***$(Configuration)\testresults\coverage
                //const resolvedReportDirectory: string = resolvePathToSingleItem(workingDirectory, reportDirectory, true);
                tl.warning(tl.loc('IgnoringReportDirectory'));
                autogenerateHtmlReport = true;
            }

            if (autogenerateHtmlReport) {
                tempFolder = path.join(getTempFolder(), 'cchtml');
                await generateHtmlReport(summaryFileLocation, tempFolder, sourceDirectory, tempFolder);
            }

            let additionalFileMatches: string[] = undefined;
            // Get any 'Additional Files' to publish as build artifacts
            if (additionalFiles) {
                // Resolve matches of the 'Additional Files' pattern
                additionalFileMatches = tl.findMatch(
                    workingDirectory,
                    additionalFiles,
                    { followSymbolicLinks: false, followSpecifiedSymbolicLink: false },
                    { matchBase: true });

                additionalFileMatches = additionalFileMatches.filter(file => pathExistsAsFile(file));
                tl.debug(tl.loc('FoundNMatchesForPattern', additionalFileMatches.length, additionalFiles));
            }

            // Publish code coverage data
            const ccPublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish(codeCoverageTool, resolvedSummaryFile, tempFolder, additionalFileMatches);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

// Resolves the specified path to a single item based on whether it contains wildcards
function resolvePathToSingleItem(workingDirectory: string, pathInput: string, isDirectory: boolean): string {
    // Default to using the specific pathInput value
    let resolvedPath: string = pathInput;

    if (pathInput) {

        // Find match patterns won't work if the directory has a trailing slash
        if (isDirectory && (pathInput.endsWith('/') || pathInput.endsWith('\\'))) {
            pathInput = pathInput.slice(0, -1);
        }
        // Resolve matches of the pathInput pattern
        const pathMatches: string[] = tl.findMatch(
            workingDirectory,
            pathInput,
            { followSymbolicLinks: false, followSpecifiedSymbolicLink: false });
        tl.debug(tl.loc('FoundNMatchesForPattern', pathMatches.length, pathInput));

        // Were any matches found?
        if (pathMatches.length === 0) {
            resolvedPath = undefined;
        } else {
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
    } catch (error) {
        tl.debug(error);
        return false;
    }
}

// Gets whether the specified path exists as Dir.
function pathExistsAsDir(path: string) {
    try {
        return tl.stats(path).isDirectory();
    } catch (error) {
        tl.debug(error);
        return false;
    }
}

function getTempFolder(): string {
    try {
        tl.assertAgent('2.115.0');
        const tmpDir = tl.getVariable('Agent.TempDirectory');
        return tmpDir;
    } catch (err) {
        tl.warning(tl.loc('UpgradeAgentMessage'));
        return os.tmpdir();
    }
}

async function generateHtmlReport(summaryFile: string, targetDir: string, sourceFolder: string, workingDir: string) {
    const dotnetPath = tl.which('dotnet', false);
    if (!dotnetPath) {
        tl.warning(tl.loc('InstallDotNetCoreForHtmlReport'));
        return;
    }

    let coverageArg = `"-reports:${summaryFile}" "-targetdir:${targetDir}" -reporttypes:HtmlInline_AzurePipelines`;
    if (sourceFolder && pathExistsAsDir(sourceFolder)) {
        coverageArg += ` "-sourcedirs:${sourceFolder}"`;
    }

    const dotnet = tl.tool(dotnetPath);
    dotnet.arg(path.join(__dirname, 'netcoreapp2.0', 'ReportGenerator.dll'));
    dotnet.line(coverageArg);

    tl.debug('Coverage report arguments: ' + coverageArg);

    try {
        const result = await dotnet.exec(<tr.IExecOptions>{
            cwd: workingDir
        });

        if (result === 0) {
            console.log(tl.loc('GeneratedHtmlReport', targetDir));
        } else {
            tl.warning(tl.loc('FailedToGenerateHtmlReport', result));
        }
    } catch (err) {
        tl.warning(tl.loc('FailedToGenerateHtmlReport', err));
    }
    return;
}

run();

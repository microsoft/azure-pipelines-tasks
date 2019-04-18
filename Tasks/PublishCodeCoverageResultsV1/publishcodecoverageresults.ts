import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
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

        let autogenerateHtmlReport: boolean = codeCoverageTool.toLowerCase() === 'cobertura';
        let tempFolder = undefined;
        const disableAutoGenerate = tl.getVariable('disable.coverage.autogenerate');

        if (disableAutoGenerate) {
            tl.debug('disabling auto generation');
            autogenerateHtmlReport = false;
            tempFolder = resolvePathToSingleItem(workingDirectory, reportDirectory, true);
        }

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

            if (autogenerateHtmlReport) {
                tempFolder = path.join(getTempFolder(), 'cchtml');
                tl.debug('Generating Html Report using ReportGenerator: ' + tempFolder);

                const result = await generateHtmlReport(summaryFileLocation, tempFolder);
                tl.debug('Result: ' + result);

                if (!result) {
                    tempFolder = resolvePathToSingleItem(workingDirectory, reportDirectory, true);
                } else {
                    // Ignore Html Report dirs going forward
                    if (reportDirectory) {
                        // Resolve the report directory.
                        // It may contain wildcards allowing the path to change between builds, such as for:
                        // $(System.DefaultWorkingDirectory)\artifacts***$(Configuration)\testresults\coverage
                        tl.warning(tl.loc('IgnoringReportDirectory'));
                        autogenerateHtmlReport = true;
                    }
                }
                tl.debug('Report directory: ' + tempFolder);
            }

            let additionalFileMatches: string[] = undefined;
            // Get any 'Additional Files' to publish as build artifacts
            const findOptions: tl.FindOptions = { allowBrokenSymbolicLinks: false, followSymbolicLinks: false, followSpecifiedSymbolicLink: false };
            const matchOptions: tl.MatchOptions = { matchBase: true };

            if (additionalFiles) {
                // Resolve matches of the 'Additional Files' pattern
                additionalFileMatches = tl.findMatch(
                    workingDirectory,
                    additionalFiles,
                    findOptions,
                    matchOptions);

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
        const findOptions: tl.FindOptions = { allowBrokenSymbolicLinks: false, followSymbolicLinks: false, followSpecifiedSymbolicLink: false };
        const pathMatches: string[] = tl.findMatch(
            workingDirectory,
            pathInput,
            findOptions);
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

async function generateHtmlReport(summaryFile: string, targetDir: string): Promise<boolean> {
    const osvar = process.platform;
    let dotnet: tr.ToolRunner;

    const dotnetPath = tl.which('dotnet', false);
    if (!dotnetPath && osvar !== 'win32') {
        tl.warning(tl.loc('InstallDotNetCoreForHtmlReport'));
        return false;
    }

    if (!dotnetPath && osvar === 'win32') {
        // use full .NET to execute
        dotnet = tl.tool(path.join(__dirname, 'net47', 'ReportGenerator.exe'));
    } else {
        dotnet = tl.tool(dotnetPath);
        dotnet.arg(path.join(__dirname, 'netcoreapp2.0', 'ReportGenerator.dll'));
    }

    dotnet.arg('-reports:' + summaryFile);
    dotnet.arg('-targetdir:' + targetDir);
    dotnet.arg('-reporttypes:HtmlInline_AzurePipelines');

    try {
        const result = await dotnet.exec(<tr.IExecOptions>{
            ignoreReturnCode: true,
            failOnStdErr: false,
            windowsVerbatimArguments: true,
            errStream: process.stdout,
            outStream: process.stdout
        });

        // Listen for stderr.
        let isError = false;
        dotnet.on('stderr', () => {
            isError = true;
        });

        if (result === 0 && !isError) {
            console.log(tl.loc('GeneratedHtmlReport', targetDir));
            return true;
        } else {
            tl.warning(tl.loc('FailedToGenerateHtmlReport', result));
        }
    } catch (err) {
        tl.warning(tl.loc('FailedToGenerateHtmlReport', err));
    }
    return false;
}

run();

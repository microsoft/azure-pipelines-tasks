import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolRunner from 'azure-pipelines-task-lib/toolrunner';
import * as os from 'os';

// Main entry point of this task.
async function run() {
    try {
        // Initialize localization
        taskLib.setResourcePath(path.join(__dirname, 'task.json'));

        // Get input values
        const summaryFileLocation = taskLib.getInput('summaryFileLocation', true);
        const additionalFiles = taskLib.getInput('additionalCodeCoverageFiles');
        const failIfCoverageIsEmpty: boolean = taskLib.getBoolInput('failIfCoverageEmpty');
        const workingDirectory: string = taskLib.getVariable('System.DefaultWorkingDirectory');
        const pathToSources: string = taskLib.getInput('pathToSources');

        let autogenerateHtmlReport: boolean = true;
        let tempFolder = undefined;

        // Resolve the summary file path.
        // It may contain wildcards allowing the path to change between builds, such as for:
        // $(System.DefaultWorkingDirectory)\artifacts***$(Configuration)\testresults\coverage\cobertura.xml
        const resolvedSummaryFile: string = resolvePathToSingleItem(workingDirectory, summaryFileLocation, false);

        taskLib.debug('Resolved summary file: ' + resolvedSummaryFile);

        if (failIfCoverageIsEmpty && await coverageUtil.isCodeCoverageFileEmpty(resolvedSummaryFile, codeCoverageTool)) {
            throw taskLib.loc('NoCodeCoverage');
        } else if (!taskLib.exist(resolvedSummaryFile)) {
            taskLib.warning(taskLib.loc('NoCodeCoverage'));
        } else {

            if (autogenerateHtmlReport) {
                tempFolder = path.join(getTempFolder(), 'cchtml');
                taskLib.debug('Generating Html Report using ReportGenerator: ' + tempFolder);

                const result = await generateHtmlReport(summaryFileLocation, tempFolder, pathToSources);
                taskLib.debug('Result: ' + result);

                if (!result) {
                    tempFolder = resolvePathToSingleItem(workingDirectory, reportDirectory, true);
                } else {
                    // Ignore Html Report dirs going forward
                    if (reportDirectory) {
                        // Resolve the report directory.
                        // It may contain wildcards allowing the path to change between builds, such as for:
                        // $(System.DefaultWorkingDirectory)\artifacts***$(Configuration)\testresults\coverage
                        taskLib.warning(taskLib.loc('IgnoringReportDirectory'));
                        autogenerateHtmlReport = true;
                    }
                }
                taskLib.debug('Report directory: ' + tempFolder);
            }

            let additionalFileMatches: string[] = undefined;
            // Get any 'Additional Files' to publish as build artifacts
            const findOptions: taskLib.FindOptions = { allowBrokenSymbolicLinks: false, followSymbolicLinks: false, followSpecifiedSymbolicLink: false };
            const matchOptions: taskLib.MatchOptions = { matchBase: true };

            if (additionalFiles) {
                // Resolve matches of the 'Additional Files' pattern
                additionalFileMatches = taskLib.findMatch(
                    workingDirectory,
                    additionalFiles,
                    findOptions,
                    matchOptions);

                additionalFileMatches = additionalFileMatches.filter(file => pathExistsAsFile(file));
                taskLib.debug(taskLib.loc('FoundNMatchesForPattern', additionalFileMatches.length, additionalFiles));
            }

            // Publish code coverage data
            const ccPublisher = new taskLib.CodeCoveragePublisher();
            ccPublisher.publish(codeCoverageTool, resolvedSummaryFile, tempFolder, additionalFileMatches);
        }
    } catch (err) {
        taskLib.setResult(taskLib.TaskResult.Failed, err);
    }
}

function resolveSummaryFiles(workingDirectory: string, summaryFiles: string): string[] {
    if(summaryFiles) {
        const summaryFilesArray = summaryFiles.trim().split('\n').filter((pattern) => pattern.trim() != "");
        const resolvedSummaryFiles = [];

        if(summaryFilesArray.length > 0) {
            summaryFilesArray.forEach(filePattern => {
                const findOptions: taskLib.FindOptions = { allowBrokenSymbolicLinks: false, followSymbolicLinks: false, followSpecifiedSymbolicLink: false };
                const pathMatches: string[] = taskLib.findMatch(
                    workingDirectory,
                    filePattern,
                    findOptions);
                
                taskLib.debug(taskLib.loc('FoundNMatchesForPattern', pathMatches.length, filePattern));

                pathMatches.forEach(element => {
                    if(taskLib.exist)
                });
            });
        }
        else {
            return []
        }
    } else {
        return [];
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
        const findOptions: taskLib.FindOptions = { allowBrokenSymbolicLinks: false, followSymbolicLinks: false, followSpecifiedSymbolicLink: false };
        const pathMatches: string[] = taskLib.findMatch(
            workingDirectory,
            pathInput,
            findOptions);
        taskLib.debug(taskLib.loc('FoundNMatchesForPattern', pathMatches.length, pathInput));

        // Were any matches found?
        if (pathMatches.length === 0) {
            resolvedPath = undefined;
        } else {
            // Select the path to be used from the matches
            resolvedPath = pathMatches[0];

            // If more than one path matches, use the first and issue a warning
            if (pathMatches.length > 1) {
                taskLib.warning(taskLib.loc('MultipleSummaryFilesFound', resolvedPath));
            }
        }
    }

    // Return resolved path
    return resolvedPath;
}

// Gets whether the specified path exists as file.
function pathExistsAsFile(path: string) {
    try {
        return taskLib.stats(path).isFile();
    } catch (error) {
        taskLib.debug(error);
        return false;
    }
}

function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input == null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

function getTempFolder(): string {
    try {
        taskLib.assertAgent('2.115.0');
        const tmpDir = taskLib.getVariable('Agent.TempDirectory');
        return tmpDir;
    } catch (err) {
        taskLib.warning(taskLib.loc('UpgradeAgentMessage'));
        return os.tmpdir();
    }
}

async function generateHtmlReport(summaryFile: string, targetDir: string, pathToSources: string): Promise<boolean> {
    const osvar = process.platform;
    let dotnet: toolRunner.ToolRunner;

    const dotnetPath = taskLib.which('dotnet', false);
    if (!dotnetPath && osvar !== 'win32') {
        taskLib.warning(taskLib.loc('InstallDotNetCoreForHtmlReport'));
        return false;
    }

    if (!dotnetPath && osvar === 'win32') {
        // use full .NET to execute
        dotnet = taskLib.tool(path.join(__dirname, 'net47', 'ReportGenerator.exe'));
    } else {
        dotnet = taskLib.tool(dotnetPath);
        dotnet.arg(path.join(__dirname, 'netcoreapp2.0', 'ReportGenerator.dll'));
    }

    dotnet.arg('-reports:' + summaryFile);
    dotnet.arg('-targetdir:' + targetDir);
    dotnet.arg('-reporttypes:HtmlInline_AzurePipelines');

    if (!isNullOrWhitespace(pathToSources)) {
        dotnet.arg('-sourcedirs:' + pathToSources);
    }

    try {
        const result = await dotnet.exec(<toolRunner.IExecOptions>{
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
            console.log(taskLib.loc('GeneratedHtmlReport', targetDir));
            return true;
        } else {
            taskLib.warning(taskLib.loc('FailedToGenerateHtmlReport', result));
        }
    } catch (err) {
        taskLib.warning(taskLib.loc('FailedToGenerateHtmlReport', err));
    }
    return false;
}

run();

import * as os from 'os';
import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as coveragePublisher from 'coveragepublisher/coveragepublisher';

const sourcePathContainmentFeature = 'EnablePublishCodeCoverageResultsV2SourcePathContainment';
const loggingCommandInjectionFixEnabled = 'PublishCodeCoverageResultsV2LoggingCommandInjectionFixEnabled';

// Main entry point of this task.
async function run() {
    try {
        // Initialize localization
        taskLib.setResourcePath(path.join(__dirname, 'task.json'));

        // Get input values
        const summaryFileLocations = taskLib.getInput('summaryFileLocation', true);
        const failIfCoverageIsEmpty: boolean = taskLib.getBoolInput('failIfCoverageEmpty');
        const workingDirectory: string = taskLib.getVariable('System.DefaultWorkingDirectory');
        const buildSourcesDirectory: string = taskLib.getVariable('Build.SourcesDirectory');
        const pathToSources: string = taskLib.getInput('pathToSources');
        const enableTrustedSourcePathFiltering = taskLib.getPipelineFeature(sourcePathContainmentFeature);
        const enableLoggingCommandFiltering = taskLib.getPipelineFeature(loggingCommandInjectionFixEnabled);
        const publishHtmlReport: boolean = taskLib.getBoolInput('publishHtmlReport');

        var resolvedSummaryFiles = resolveSummaryFiles(workingDirectory, summaryFileLocations, enableLoggingCommandFiltering)

        if(resolvedSummaryFiles.length === 0) {
            if(failIfCoverageIsEmpty === true) {
                throw taskLib.loc('NoCodeCoverage');
            } else {
                taskLib.warning(taskLib.loc('NoCodeCoverage'));
            }
        }
        else{
            await coveragePublisher.PublishCodeCoverage(
                resolvedSummaryFiles,
                pathToSources, publishHtmlReport,
                enableTrustedSourcePathFiltering
                    ? [workingDirectory, buildSourcesDirectory].filter(directory => !!directory)
                    : undefined,
                enableTrustedSourcePathFiltering,
                enableLoggingCommandFiltering);
        }       

    } catch (err) {
        taskLib.setResult(taskLib.TaskResult.Failed, err);
    }
}

function resolveSummaryFiles(workingDirectory: string, summaryFiles: string, enableLoggingCommandFiltering: boolean): string[] {
    if(summaryFiles) {
        const summaryFilesArray = summaryFiles.trim().split('\n').filter((pattern) => pattern.trim() != "");
        const resolvedSummaryFiles: string[] = [];

        if(summaryFilesArray.length > 0) {
            summaryFilesArray.forEach(filePattern => {
                const findOptions: taskLib.FindOptions = { allowBrokenSymbolicLinks: false, followSymbolicLinks: false, followSpecifiedSymbolicLink: false };
                const pathMatches: string[] = taskLib.findMatch(
                    workingDirectory,
                    filePattern,
                    findOptions);
                
                console.log(taskLib.loc('FoundNMatchesForPattern', pathMatches.length, filePattern));

                pathMatches.forEach(path => {
                    if(pathExistsAsFile(path)) {
                        resolvedSummaryFiles.push(path);
                        if (enableLoggingCommandFiltering) {
                            taskLib.writeExternalOutput(path + os.EOL, { source: 'repository' });
                        } else {
                            console.log(path);
                        }
                    }
                });
            });

            return resolvedSummaryFiles;
        }
    }

    return [];
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

run();

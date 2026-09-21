import * as path from 'path';
import * as fs from 'fs';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as coveragePublisher from 'azure-pipelines-tasks-coveragepublisher/coveragepublisher';

interface ResolvedCoverageFile {
    filePath: string;
    sourcePatternIndexes: number[];
}

// Main entry point of this task.
async function run() {
    try {
        // Initialize localization
        taskLib.setResourcePath(path.join(__dirname, 'task.json'));

        // Get input values
        const summaryFileLocations = taskLib.getInput('summaryFileLocation', true);
        const failIfCoverageIsEmpty: boolean = taskLib.getBoolInput('failIfCoverageEmpty');
        const workingDirectory: string = taskLib.getVariable('System.DefaultWorkingDirectory');
        const pathToSources: string = taskLib.getInput('pathToSources');

        const resolvedSummaryFiles = resolveSummaryFiles(workingDirectory, summaryFileLocations);

        if(resolvedSummaryFiles.length === 0) {
            if(failIfCoverageIsEmpty === true) {
                throw taskLib.loc('NoCodeCoverage');
            } else {
                taskLib.warning(taskLib.loc('NoCodeCoverage'));
            }
        }
        else{
            await coveragePublisher.PublishCodeCoverage(resolvedSummaryFiles, pathToSources, {
                workingDirectory,
                taskVersion: getTaskVersion(),
                taskInstanceId: taskLib.getVariable('System.TaskInstanceId')
            });
        }       

    } catch (err) {
        taskLib.setResult(taskLib.TaskResult.Failed, err);
    }
}

function resolveSummaryFiles(workingDirectory: string, summaryFiles: string): ResolvedCoverageFile[] {
    if(summaryFiles) {
        const summaryFilesArray = summaryFiles.trim().split('\n').filter((pattern) => pattern.trim() != "");
        const resolvedSummaryFiles = new Map<string, ResolvedCoverageFile>();

        if(summaryFilesArray.length > 0) {
            summaryFilesArray.forEach((filePattern, patternIndex) => {
                const findOptions: taskLib.FindOptions = { allowBrokenSymbolicLinks: false, followSymbolicLinks: false, followSpecifiedSymbolicLink: false };
                const pathMatches: string[] = taskLib.findMatch(
                    workingDirectory,
                    filePattern,
                    findOptions);
                
                console.log(taskLib.loc('FoundNMatchesForPattern', pathMatches.length, filePattern));

                pathMatches.forEach(path => {
                    if(pathExistsAsFile(path)) {
                        const normalizedPath = resolvePathForComparison(path);
                        const existing = resolvedSummaryFiles.get(normalizedPath);
                        if (existing) {
                            if (!existing.sourcePatternIndexes.includes(patternIndex)) {
                                existing.sourcePatternIndexes.push(patternIndex);
                            }
                        } else {
                            resolvedSummaryFiles.set(normalizedPath, {
                                filePath: path,
                                sourcePatternIndexes: [patternIndex]
                            });
                        }
                        console.log(path);
                    }
                });
            });

            return Array.from(resolvedSummaryFiles.values());
        }
    }

    return [];
}

function resolvePathForComparison(filePath: string): string {
    const resolvedPath = path.resolve(filePath);
    return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
}

function getTaskVersion(): string {
    const taskDefinition = JSON.parse(fs.readFileSync(path.join(__dirname, 'task.json'), 'utf8'));
    return `${taskDefinition.version.Major}.${taskDefinition.version.Minor}.${taskDefinition.version.Patch}`;
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

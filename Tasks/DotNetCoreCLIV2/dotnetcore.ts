import tl = require("azure-pipelines-task-lib/task");
import tr = require("azure-pipelines-task-lib/toolrunner");
import path = require("path");
import fs = require("fs");
var archiver = require('archiver');

import * as packCommand from './packcommand';
import * as pushCommand from './pushcommand';
import * as restoreCommand from './restorecommand';
import * as utility from './Common/utility';

export class dotNetExe {
    private command: string;
    private projects: string[];
    private arguments: string;
    private publishWebProjects: boolean;
    private zipAfterPublish: boolean;
    private outputArgument: string = "";
    private outputArgumentIndex: number = 0;
    private workingDirectory: string;
    private testRunSystem: string = "VSTS - dotnet";

    constructor() {
        this.command = tl.getInput("command");
        this.projects = tl.getDelimitedInput("projects", "\n", false);
        this.arguments = tl.getInput("arguments", false) || "";
        this.publishWebProjects = tl.getBoolInput("publishWebProjects", false);
        this.zipAfterPublish = tl.getBoolInput("zipAfterPublish", false);
        this.workingDirectory = tl.getPathInput("workingDirectory", false);
    }

    public async execute() {
        tl.setResourcePath(path.join(__dirname, "task.json"));
        this.setConsoleCodePage();

        switch (this.command) {
            case "build":
            case "publish":
            case "run":
                await this.executeBasicCommand();
                break;
            case "custom":
                this.command = tl.getInput("custom", true);
                await this.executeBasicCommand();
                break;
            case "test":
                await this.executeTestCommand();
                break;
            case "restore":
                await restoreCommand.run();
                break;
            case "pack":
                await packCommand.run();
                break;
            case "push":
                await pushCommand.run();
                break;
            default:
                tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", this.command));
        }
    }

    private setConsoleCodePage() {
        // set the console code page to "UTF-8"
        if (tl.osType() === 'Windows_NT') {
            try {
                tl.execSync(path.resolve(process.env.windir, "system32", "chcp.com"), ["65001"]);
            }
            catch (ex) {
                tl.warning(tl.loc("CouldNotSetCodePaging", JSON.stringify(ex)))
            }
        }
    }

    private async executeBasicCommand() {
        var dotnetPath = tl.which("dotnet", true);

        this.extractOutputArgument();

        // Use empty string when no project file is specified to operate on the current directory
        var projectFiles = this.getProjectFiles();
        if (projectFiles.length === 0) {
            throw tl.loc("noProjectFilesFound");
        }
        var failedProjects: string[] = [];
        for (const fileIndex of Object.keys(projectFiles)) {
            var projectFile = projectFiles[fileIndex];
            var dotnet = tl.tool(dotnetPath);
            dotnet.arg(this.command);
            dotnet.arg(projectFile);
            var dotnetArguments = this.arguments;
            if (this.isPublishCommand() && this.outputArgument && tl.getBoolInput("modifyOutputPath")) {
                var output = dotNetExe.getModifiedOutputForProjectFile(this.outputArgument, projectFile);
                dotnetArguments = this.replaceOutputArgument(output);
            }
            dotnet.line(dotnetArguments);
            try {
                var result = await dotnet.exec(<tr.IExecOptions>{
                    cwd: this.workingDirectory
                });
                await this.zipAfterPublishIfRequired(projectFile);
            } catch (err) {
                tl.error(err);
                failedProjects.push(projectFile);
            }
        }
        if (failedProjects.length > 0) {
            throw tl.loc("dotnetCommandFailed", failedProjects);
        }
    }

    private async executeTestCommand(): Promise<void> {
        const dotnetPath = tl.which('dotnet', true);
        const enablePublishTestResults: boolean = tl.getBoolInput('publishTestResults', false) || false;
        const resultsDirectory = tl.getVariable('Agent.TempDirectory');
        if (enablePublishTestResults && enablePublishTestResults === true) {
            this.arguments = ` --logger trx --results-directory "${resultsDirectory}" `.concat(this.arguments);
        }

        // Remove old trx files
        if (enablePublishTestResults && enablePublishTestResults === true) {
            this.removeOldTestResultFiles(resultsDirectory);
        }

        // Use empty string when no project file is specified to operate on the current directory
        const projectFiles = this.getProjectFiles();
        if (projectFiles.length === 0) {
            tl.warning(tl.loc('noProjectFilesFound'));
            return;
        }

        const failedProjects: string[] = [];
        for (const fileIndex of Object.keys(projectFiles)) {
            const projectFile = projectFiles[fileIndex];
            const dotnet = tl.tool(dotnetPath);
            dotnet.arg(this.command);
            dotnet.arg(projectFile);
            dotnet.line(this.arguments);
            try {
                const result = await dotnet.exec(<tr.IExecOptions>{
                    cwd: this.workingDirectory
                });
            } catch (err) {
                tl.error(err);
                failedProjects.push(projectFile);
            }
        }
        if (enablePublishTestResults && enablePublishTestResults === true) {
            this.publishTestResults(resultsDirectory);
        }
        if (failedProjects.length > 0) {
            throw tl.loc('dotnetCommandFailed', failedProjects);
        }
    }

    private publishTestResults(resultsDir: string): void {
        const buildConfig = tl.getVariable('BuildConfiguration');
        const buildPlaform = tl.getVariable('BuildPlatform');
        const testRunTitle = tl.getInput("testRunTitle", false) || "";
        const matchingTestResultsFiles: string[] = tl.findMatch(resultsDir, '**/*.trx');
        if (!matchingTestResultsFiles || matchingTestResultsFiles.length === 0) {
            tl.warning('No test result files were found.');
        } else {
            const tp: tl.TestPublisher = new tl.TestPublisher('VSTest');
            tp.publish(matchingTestResultsFiles, 'false', buildPlaform, buildConfig, testRunTitle, 'true', this.testRunSystem);
            //refer https://github.com/Microsoft/vsts-task-lib/blob/master/node/task.ts#L1620
        }
    }

    private removeOldTestResultFiles(resultsDir:string): void {
        const matchingTestResultsFiles: string[] = tl.findMatch(resultsDir, '**/*.trx');
        if (!matchingTestResultsFiles || matchingTestResultsFiles.length === 0) {
            tl.debug("No old result files found.");
            return;
        }
        for (const fileIndex of Object.keys(matchingTestResultsFiles)) {
            const resultFile = matchingTestResultsFiles[fileIndex];
            tl.rmRF(resultFile)
            tl.debug("Successfuly removed: " + resultFile);
        }
    }

    private replaceOutputArgument(modifiedOutput: string) {
        var str = this.arguments;
        var index = this.outputArgumentIndex;
        return str.substr(0, index) + str.substr(index).replace(this.outputArgument, modifiedOutput);
    }

    private async zipAfterPublishIfRequired(projectFile: string) {
        if (this.isPublishCommand() && this.zipAfterPublish) {
            var outputSource: string = "";
            var moveZipToOutputSource = false;
            if (this.outputArgument) {
                if (tl.getBoolInput("modifyOutputPath") && projectFile) {
                    outputSource = dotNetExe.getModifiedOutputForProjectFile(this.outputArgument, projectFile);
                } else {
                    outputSource = this.outputArgument;
                    moveZipToOutputSource = true;
                }

            }
            else {
                var pattern = "**/publish";
                var files = tl.findMatch(path.dirname(projectFile), pattern);
                for (var fileIndex in files) {
                    var file = files[fileIndex];
                    if (fs.lstatSync(file).isDirectory) {
                        outputSource = file;
                        break;
                    }
                }
            }

            tl.debug("Zip Source: " + outputSource);
            if (outputSource) {
                var outputTarget = outputSource + ".zip";
                await this.zip(outputSource, outputTarget);
                tl.rmRF(outputSource);
                if (moveZipToOutputSource) {
                    fs.mkdirSync(outputSource);
                    fs.renameSync(outputTarget, path.join(outputSource, path.basename(outputTarget)));
                }
            }
            else {
                throw tl.loc("noPublishFolderFoundToZip", projectFile);
            }
        }
    }

    private zip(source: string, target: string) {
        tl.debug("Zip arguments: Source: " + source + " , target: " + target);

        return new Promise((resolve, reject) => {
            var output = fs.createWriteStream(target);

            output.on('close', function () {
                tl.debug('Successfully created archive ' + target);
                resolve(target);
            });

            output.on('error', function (error) {
                reject(error);
            });

            var archive = archiver('zip');
            archive.pipe(output);
            archive.directory(source, '/');
            archive.finalize();
        });
    }

    private extractOutputArgument(): void {
        if (!this.arguments || !this.arguments.trim()) {    
            return;
        }

        var argString = this.arguments.trim();
        var isOutputOption = false;
        var inQuotes = false;
        var escaped = false;
        var arg = '';
        var i = 0;
        var append = function (c) {
            // we only escape double quotes.
            if (escaped && c !== '"') {
                arg += '\\';
            }
            arg += c;
            escaped = false;
        };
        var nextArg = function () {
            arg = '';
            for (; i < argString.length; i++) {
                var c = argString.charAt(i);
                if (c === '"') {
                    if (!escaped) {
                        inQuotes = !inQuotes;
                    }
                    else {
                        append(c);
                    }
                    continue;
                }
                if (c === "\\" && inQuotes && !escaped) {
                    escaped = true;
                    continue;
                }
                if (c === ' ' && !inQuotes) {
                    if (arg.length > 0) {
                        return arg.trim();
                    }
                    continue;
                }
                append(c);
            }

            if (arg.length > 0) {
                return arg.trim();
            }

            return null;
        }

        var token = nextArg();
        while (token) {
            var tokenUpper = token.toUpperCase();
            if (this.isPublishCommand() && (tokenUpper === "--OUTPUT" || tokenUpper === "-O")) {
                isOutputOption = true;
                this.outputArgumentIndex = i;
            }
            else if (isOutputOption) {
                this.outputArgument = token;
                isOutputOption = false;
            }

            token = nextArg();
        }
    }

    private getProjectFiles(): string[] {
        var projectPattern = this.projects;
        var searchWebProjects = this.isPublishCommand() && this.publishWebProjects;
        if (searchWebProjects) {
            projectPattern = ["**/*.csproj", "**/*.vbproj", "**/*.fsproj"];
        }

        var projectFiles = utility.getProjectFiles(projectPattern);

        if (searchWebProjects) {
            projectFiles = projectFiles.filter(function (file, index, files): boolean {
                var directory = path.dirname(file);
                return tl.exist(path.join(directory, "web.config"))
                    || tl.exist(path.join(directory, "wwwroot"));
            });

            if (!projectFiles.length) {
                tl.error(tl.loc("noWebProjctFound"));
            }
        }

        return projectFiles;
    }

    private isPublishCommand(): boolean {
        return this.command === "publish";
    }

    private static getModifiedOutputForProjectFile(outputBase: string, projectFile: string): string {
        return path.join(outputBase, path.basename(path.dirname(projectFile)));
    }
}

var exe = new dotNetExe();
exe.execute().catch((reason) => tl.setResult(tl.TaskResult.Failed, reason));

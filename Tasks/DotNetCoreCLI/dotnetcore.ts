import tl = require("vsts-task-lib/task");
import path = require("path");
import fs = require("fs");
import ffl = require('find-files-legacy/findfiles.legacy');
var gulp = require('gulp');
var zip = require('gulp-zip');

export class dotNetExe {
    private command: string;
    private projects: string;
    private arguments: string;
    private publishWebProjects: boolean;
    private zipAfterPublish: boolean;
    private outputArgument: string;
    private remainingArgument: string;

    constructor() {
        this.command = tl.getInput("command");
        this.projects = tl.getInput("projects", false);
        this.arguments = tl.getInput("arguments", false);
        this.publishWebProjects = tl.getBoolInput("publishWebProjects", false);
        this.zipAfterPublish = tl.getBoolInput("zipAfterPublish", false);
    }

    public async execute() {
        var dotnetPath = tl.which("dotnet", true);

        this.extractOutputArgument();

        // Use empty string when no project file is specified to operate on the current directory
        var projectFiles = [""];
        if (this.projects || (this.isPublishCommand() && this.publishWebProjects)) {
            projectFiles = this.getProjectFiles();
        } 

        for (var fileIndex in projectFiles) {
            var projectFile = projectFiles[fileIndex];
            try {
                var dotnet = tl.tool(dotnetPath);
                dotnet.arg(this.command);
                dotnet.arg(projectFile);
                dotnet.line(this.getCommandArguments(projectFile));

                var result = dotnet.execSync();
                if (result.code != 0) {
                    tl.setResult(result.code, tl.loc("dotnetCommandFailed", result.code));
                }

                await this.zipAfterPublishIfRequired(projectFile);
            }
            catch (err)
            {
                tl.setResult(1, err.message);
            }
        }
    }

    private async zipAfterPublishIfRequired(projectFile: string) {
        if (this.isPublishCommand() && this.zipAfterPublish) {
            var outputSource: string = "";
            if (this.outputArgument) {
                outputSource = dotNetExe.getModifiedOutputForProjectFile(this.outputArgument, projectFile);
            }
            else {
                var pattern = path.dirname(projectFile) + "/**/publish";
                var files = ffl.findFiles(pattern, true);
                for (var fileIndex in files) {
                    var file = files[fileIndex];
                    if (fs.lstatSync(file).isDirectory) {
                        outputSource = file;
                        break;
                    }
                }
            }

            if (outputSource && tl.exist(outputSource)) {
                var outputTarget = outputSource + ".zip";
                await this.zip(outputSource, outputTarget);
                tl.rmRF(outputSource, true);
            }
            else {
                tl.warning(tl.loc("noPublishFolderFoundToZip", projectFile));
            }
        }
    }

    private zip (source: string, target: string) {
        tl.debug("Zip arguments: Source: " + source + " , target: " + target);
        return new Promise((resolve, reject) => {
            gulp.src(path.join(source, '**', '*'))
            .pipe(zip(path.basename(target)))
            .pipe(gulp.dest(path.dirname(target))).on('end', function(error){
                error ? reject(tl.loc("zipFailed", error)) : resolve("");
                })});
    }

    private getCommandArguments(projectFile: string): string {
        if (this.isPublishCommand() && this.outputArgument) {
            var output = dotNetExe.getModifiedOutputForProjectFile(this.outputArgument, projectFile);
            var commandArgument = this.remainingArgument + ' --output ' + output;
            tl.debug("CommandArguments: " + commandArgument);
            return commandArgument;
        }

        return this.arguments;
    }

    private extractOutputArgument(): void {
        this.outputArgument = this.remainingArgument = "";
        if (this.isPublishCommand() && this.arguments) {
            var args = this.arguments.trim();
            var i = 0;
            var isOutputOption = false;
            while (i < args.length) {
                var nextIndex = this.getNextTokenStartIndex(args, i);
                var token = args.substr(i, nextIndex - i).trim();
                var tokenUpper = token.toUpperCase();
                if (isOutputOption) {
                    this.outputArgument = token;
                    isOutputOption = false;
                }
                else if (tokenUpper === "--OUTPUT" || tokenUpper === "-O") {
                    isOutputOption = true;
                }
                else {
                    this.remainingArgument += (" " + token);
                }

                i = nextIndex;
            }
        }
    }

    private getNextTokenStartIndex (input, currentPosition): number {
        for(; currentPosition < input.length; currentPosition++)
        {
            if(input[currentPosition] == " " || input[currentPosition] == "\t") {
                // Skip all whitespaces.
                for(currentPosition++; currentPosition < input.length; currentPosition++) {
                    if(input[currentPosition] != " " && input[currentPosition] != "\t") {
                        break;
                    }
                }

                break;
            }
            else if(input[currentPosition] === "\"") {
                currentPosition = this.findClosingQuoteIndex(input, currentPosition + 1, "\"");
            }
            else if(input[currentPosition] === "'") {
                currentPosition = this.findClosingQuoteIndex(input, currentPosition + 1, "'");
            }
        }

        return currentPosition;
    }

    private findClosingQuoteIndex (input, currentPosition, closingQuote): number {
        for(; currentPosition < input.length; currentPosition++) {
            if(input[currentPosition] === closingQuote)
            {
                break;
            }
        }

        return currentPosition;
    }

     private getProjectFiles(): string [] {
        var projectPattern = this.projects;
        var searchWebProjects = this.isPublishCommand() && this.publishWebProjects;
        if (searchWebProjects) {
            projectPattern = "**/project.json";
        }

        var projectFiles = ffl.findFiles(projectPattern, false);
        if (!projectFiles || !projectFiles.length) {
            tl.warning(tl.loc("noProjectFilesFound"));
            return [];
        }

        if (searchWebProjects) {
            projectFiles = projectFiles.filter(function(file, index, files): boolean {
                var directory = path.dirname(file);
                return tl.exist(path.join(directory, "web.config")) 
                    || tl.exist(path.join(directory, "wwwroot"));
            });

            if (!projectFiles.length) {
                tl.warning(tl.loc("noWebProjctFound"));
            }
        }

        return projectFiles;
    }

    private isPublishCommand(): boolean {
        return this.command === "publish";
    }

    private static getModifiedOutputForProjectFile(outputBase: string, projectFile: string) : string {
        return path.join(outputBase, path.basename(path.dirname(projectFile)));
    }
}

var exe = new dotNetExe();
exe.execute().catch((reason) => tl.setResult(1, reason));
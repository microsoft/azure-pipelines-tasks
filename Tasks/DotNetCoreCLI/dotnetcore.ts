import tl = require("vsts-task-lib/task");
import path = require("path");
import fs = require("fs");
import ffl = require('find-files-legacy/findfiles.legacy');
var archiver = require('archiver');

export class dotNetExe {
    private command: string;
    private projects: string;
    private arguments: string;
    private publishWebProjects: boolean;
    private zipAfterPublish: boolean;
    private outputArgument: string = "";
    private remainingArguments: string[] = [];

    constructor() {
        this.command = tl.getInput("command");
        this.projects = tl.getInput("projects", false);
        this.arguments = tl.getInput("arguments", false);
        this.publishWebProjects = tl.getBoolInput("publishWebProjects", false);
        this.zipAfterPublish = tl.getBoolInput("zipAfterPublish", false);
    }

    public async execute() {
        tl.setResourcePath(path.join(__dirname, "task.json"));
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
                if (this.remainingArguments.length > 0) {
                    dotnet.arg(this.remainingArguments);
                }

                if (this.isPublishCommand() && this.outputArgument) {
                    var output = dotNetExe.getModifiedOutputForProjectFile(this.outputArgument, projectFile);
                    dotnet.arg("--output");
                    dotnet.arg(output);
                }

                var result = dotnet.execSync();
                if (result.code != 0) {
                    var error = result.stderr.replace("\r", "%0D");
                    tl.error(error.replace("\n", "%0A"));
                    tl.setResult(result.code, tl.loc("dotnetCommandFailed", result.code));
                }

                await this.zipAfterPublishIfRequired(projectFile);
            }
            catch (err) {
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

            tl.debug("Zip Source: " + outputSource);
            if (outputSource) {
                var outputTarget = outputSource + ".zip";
                await this.zip(outputSource, outputTarget);
                tl.rmRF(outputSource, true);
            }
            else {
                tl.warning(tl.loc("noPublishFolderFoundToZip", projectFile));
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
            }
            else if (isOutputOption) {
                this.outputArgument = token;
                isOutputOption = false;
            }
            else {
                this.remainingArguments.push(token);
            }

            token = nextArg();
        }
    }

    private getProjectFiles(): string[] {
        var projectPattern = this.projects;
        var searchWebProjects = this.isPublishCommand() && this.publishWebProjects;
        if (searchWebProjects) {
            projectPattern = "**/project.json";
            // projectPattern = "**/project.json;**/*.csproj";
        }

        var projectFiles = ffl.findFiles(projectPattern, false);
        if (!projectFiles || !projectFiles.length) {
            tl.warning(tl.loc("noProjectFilesFound"));
            return [];
        }

        if (searchWebProjects) {
            projectFiles = projectFiles.filter(function (file, index, files): boolean {
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

    private static getModifiedOutputForProjectFile(outputBase: string, projectFile: string): string {
        return path.join(outputBase, path.basename(path.dirname(projectFile)));
    }
}

var exe = new dotNetExe();
exe.execute().catch((reason) => tl.setResult(1, reason));
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const tl = require("azure-pipelines-task-lib");
const helpers = require("./universalPackageHelpers");
function run(context) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            helpers.logInfo('Info_DownloadingPackage', context.packageName, context.packageVersion, context.directory);
            tl.debug(tl.loc("Debug_UsingArtifactToolDownload"));
            const command = new Array();
            command.push("universal", "download", "--feed", context.feedName, "--service", context.serviceUri, "--package-name", context.packageName, "--package-version", context.packageVersion, "--path", context.directory, "--patvar", "UNIVERSAL_AUTH_TOKEN", "--verbosity", context.verbosity);
            if (context.projectName) {
                command.push("--project", context.projectName);
            }
            tl.debug(tl.loc("Debug_Downloading", context.packageName, context.packageVersion, context.feedName, context.projectName));
            const execResult = helpers.artifactToolRunner.runArtifactTool(context.artifactToolPath, command, context.toolRunnerOptions);
            if (execResult.code !== 0) {
                helpers.logCommandResult("Packaging", "UniversalPackagesCommand", execResult.code);
                throw new Error(tl.loc("Error_UnexpectedErrorArtifactToolDownload", execResult.code, execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
            }
            helpers.logInfo("Success_PackagesDownloaded", context.packageName, context.packageVersion, context.feedName);
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("Success_PackagesDownloaded", context.packageName, context.packageVersion, context.feedName));
        }
        catch (err) {
            yield helpers.handleTaskError(err, tl.loc('Error_PackagesFailedToDownload', context.packageName, context.packageVersion, context.feedName), context);
        }
    });
}

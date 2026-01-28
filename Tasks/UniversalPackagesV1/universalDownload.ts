import * as tl from "azure-pipelines-task-lib";
import { IExecSyncResult } from "azure-pipelines-task-lib/toolrunner";
import { UniversalPackageContext } from "./UniversalPackageContext";
import * as helpers from "./universalPackageHelpers";

export async function run(context: UniversalPackageContext): Promise<void> {
    try {
        tl.debug(tl.loc('Debug_DownloadOperation', context.packageName, context.packageVersion, context.directory));
        tl.debug(tl.loc("Debug_UsingArtifactToolDownload"));

        const command = new Array<string>();
        command.push("universal", "download",
            "--feed", context.feedName,
            "--service", context.serviceUri,
            "--package-name", context.packageName,
            "--package-version", context.packageVersion,
            "--path", context.directory,
            "--patvar", "UNIVERSAL_AUTH_TOKEN",
            "--verbosity", context.verbosity);

        if (context.projectName) {
            command.push("--project", context.projectName);
        }

        tl.debug(tl.loc("Debug_Downloading", context.packageName, context.packageVersion, context.feedName, context.projectName));
        const execResult: IExecSyncResult = helpers.artifactToolRunner.runArtifactTool(context.artifactToolPath, command, context.toolRunnerOptions);
        
        if (execResult.code !== 0) {
            helpers.logCommandResult("Packaging", "UniversalPackagesCommand", execResult.code);
            throw new Error(tl.loc("Error_UnexpectedErrorArtifactToolDownload",
                execResult.code,
                execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Success_PackagesDownloaded"));
    } catch (err) {
        await helpers.handleTaskError(err, tl.loc('Error_PackagesFailedToDownload'), context);
    }
}


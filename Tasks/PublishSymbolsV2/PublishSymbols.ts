import * as fs from "fs";
import * as uuidV4 from 'uuid/v4';
import * as telemetry from "utility-common/telemetry";
import * as clientToolUtils from "clienttool-common/ClientToolUtilities";
import * as clientToolRunner from "clienttool-common/ClientToolRunner";
import * as tl from "azure-pipelines-task-lib";
import { IExecSyncResult, IExecOptions } from "azure-pipelines-task-lib/toolrunner";

const symbolRequestAlreadyExistsError = 17;

export async function run(clientToolFilePath: string): Promise<void> {

    try {
        // Get the inputs.
        tl.debug("Getting client tool inputs");

        let defaultSymbolFolder: string = tl.getInput("Build.SourcesDirectory", false) ? tl.getInput("Build.SourcesDirectory", false) : "";
        let sourceFolder: string = tl.getInput("SourceFolder", false) ? tl.getInput("SourceFolder", false) : defaultSymbolFolder;
        let uniqueId: string = tl.getInput("Build.UniqueId", false) ? tl.getInput("Build.UniqueId", false) : uuidV4();
        let AsAccountName = tl.getInput("ArtifactServices.Symbol.AccountName");
        let personalAccessToken = tl.getInput("ArtifactServices.Symbol.PAT");
        let indexableFileFormats = tl.getInput("IndexableFileFormats", false);
        let symbolServiceUri = "https://" + encodeURIComponent(AsAccountName) + ".artifacts.visualstudio.com"
        let requestName = (tl.getInput("System.TeamProject") + "/" +
            tl.getInput("Build.DefinitionName") + "/" +
            tl.getInput("Build.BuildNumber") + "/" +
            tl.getInput("Build.BuildId")  + "/" +  
            uniqueId
           ).toLowerCase();

        let expirationInDays: string = '3650';
        let execResult: IExecSyncResult;
        if (fs.existsSync(clientToolFilePath)) {
            // Get NetCore client tool file path for symbols indexing
            // if file path existing or non-Windows agent, publishing symbols.
            tl.debug("Publishing the symbols");
            tl.debug(`Using endpoint ${symbolServiceUri} to create request ${requestName} with content in ${sourceFolder}`);
            
            tl.debug(`Removing trailing '\/' in ${symbolServiceUri}`);
            symbolServiceUri = clientToolUtils.trimEnd(symbolServiceUri, '/');

            const publishOptions = {
                clientToolFilePath,
                expirationInDays,
                indexableFileFormats,
                personalAccessToken,
                requestName,
                symbolServiceUri
            } as clientToolRunner.IClientToolOptions;

            let toolRunnerOptions = clientToolRunner.getOptions();
            execResult = publishSymbolsUsingClientTool(sourceFolder, publishOptions, toolRunnerOptions);

            if (execResult != null && execResult.code === symbolRequestAlreadyExistsError) {
                telemetry.logResult("Symbols", "PublishingCommand", execResult.code);
                throw new Error(tl.loc("Error_UnexpectedErrorClientTool",
                    execResult.code,
                    execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
            }

            tl.setResult(tl.TaskResult.Succeeded, tl.loc("SymbolsPublishedSuccessfully") + execResult.stdout.trim());
        }
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToPublishSymbols", error.message));

    } finally {
        process.env['SYMBOL_PAT_AUTH_TOKEN'] = '';
    }
}

function publishSymbolsUsingClientTool(
    sourcePath: string,
    options: clientToolRunner.IClientToolOptions,
    execOptions: IExecOptions) {
    const command = new Array<string>();
    command.push(
        "publish",
        "--service", options.symbolServiceUri,
        "--name", options.requestName,
        "--directory", sourcePath
    );

    if (options.expirationInDays) {
        command.push("--expirationInDays", options.expirationInDays);
    }

    if (options.personalAccessToken) {
        process.env['SYMBOL_PAT_AUTH_TOKEN'] = options.personalAccessToken
        command.push("--patAuthEnvVar", 'SYMBOL_PAT_AUTH_TOKEN');
    }

    if (options.indexableFileFormats) {
        command.push("--indexableFileFormats", options.indexableFileFormats);
    }

    console.log(tl.loc("Info_ClientTool", options.clientToolFilePath));
    const execResult: IExecSyncResult = clientToolRunner.runClientTool(
        options.clientToolFilePath,
        command,
        execOptions
    );

    if (execResult.code === 0 || execResult.code == symbolRequestAlreadyExistsError) {
        return execResult;
    }

    telemetry.logResult("Symbols", "PublishingCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorSymbolsPublishing",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
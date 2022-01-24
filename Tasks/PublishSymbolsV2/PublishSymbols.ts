import * as fs from "fs";
import * as path from "path";
import * as uuidV4 from 'uuid/v4';
import * as telemetry from "utility-common-v2/telemetry";
import * as clientToolUtils from "clienttool-common/ClientToolUtilities";
import * as clientToolRunner from "clienttool-common/ClientToolRunner";
import * as tl from "azure-pipelines-task-lib/task";
import { IExecSyncResult, IExecOptions } from "azure-pipelines-task-lib/toolrunner";

const symbolRequestAlreadyExistsError = 17;

export async function run(clientToolFilePath: string): Promise<void> {

    try {
        // Get the inputs.
        tl.debug("Getting client tool inputs");

        let defaultSymbolFolder: string = tl.getVariable("Build.SourcesDirectory") ? tl.getVariable("Build.SourcesDirectory") : "";
        let sourceFolder: string = tl.getInput("SourceFolder", false) ? tl.getInput("SourceFolder", false) : defaultSymbolFolder;
        let uniqueId: string = tl.getVariable("Build.UniqueId") ? tl.getVariable("Build.UniqueId") : uuidV4();
        let AsAccountName = tl.getVariable("ArtifactServices.Symbol.AccountName");
        let personalAccessToken = tl.getVariable("ArtifactServices.Symbol.PAT");
        let searchPattern = tl.getDelimitedInput("SearchPattern", "\n", false);
        let indexableFileFormats = tl.getInput("IndexableFileFormats", false);
        let symbolServiceUri = "https://" + encodeURIComponent(AsAccountName) + ".artifacts.visualstudio.com"
        let requestName = (tl.getVariable("System.TeamProject") + "/" +
            tl.getVariable("Build.DefinitionName") + "/" +
            tl.getVariable("Build.BuildNumber") + "/" +
            tl.getVariable("Build.BuildId")  + "/" +  
            uniqueId).toLowerCase();

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
                throw new Error(tl.loc("Error_UnexpectedErrorSymbolsPublishing",
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
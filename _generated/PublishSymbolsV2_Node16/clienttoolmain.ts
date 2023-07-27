import * as path from "path";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import * as tl from "azure-pipelines-task-lib";
import * as publishSymbols from "./PublishSymbols";

tl.setResourcePath(path.join(__dirname, "task.json"));
const clientToolFilePath = tl.getTaskVariable('SYMBOLTOOL_FILE_PATH');

async function main(): Promise<void> {
    try {
        const indexSymbolsSet = tl.getBoolInput("IndexSources", false);
        if (indexSymbolsSet) {
            console.log(tl.loc("IndexingNotSupported"));
        }

        const needsToPublishSymbols = tl.getBoolInput("PublishSymbols", true);

        if (needsToPublishSymbols) {
            publishSymbols.run(clientToolFilePath);
        }
        else {
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("PublishOptionNotSet"));
        }
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToRunClientTool", error.message));
        return;
    } finally {
        logTelemetry(clientToolFilePath);
    }
}

function logTelemetry(params: any) {
    try {
        let clientToolTelemetry = {
            "command": "publish",
            "clientToolPath": clientToolFilePath,
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            "verbose": tl.getBoolInput("DetailedLog"),
        };
        telemetry.emitTelemetry("Symbol", "PublishSymbolsV2", clientToolTelemetry);
    } catch (err) {
        tl.debug(`Unable to log PublishSymbolsV2 task telemetry.Err: (${err} )`);
    }
}

main();
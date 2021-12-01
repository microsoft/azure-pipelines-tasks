import * as path from "path";
import * as telemetry from "utility-common/telemetry";
import * as tl from "azure-pipelines-task-lib";
import * as publishSymbols from "./PublishSymbols";

tl.setResourcePath(path.join(__dirname, "task.json"));
const clientToolFilePath = tl.getInput('CLIENTTOOL_FILE_PATH');

async function main(): Promise<void> {

    try {

        // Calling the command. publish or others
        const clientToolCommand = tl.getInput("command", true);

        switch (clientToolCommand) {
            case "publish":
                publishSymbols.run(clientToolFilePath);
                break;
            default:
                tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", clientToolCommand));
                break;
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
            "command": tl.getInput("command"),
            "clientToolPath": clientToolFilePath,
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            "verbosity": tl.getInput("verbosity"),
        };
        telemetry.emitTelemetry("Symbol", "PublishSymbolsV2", clientToolTelemetry);
    } catch (err) {
        tl.debug(`Unable to log PublishSymbolsV2 task telemetry.Err: (${err} )`);
    }
}

main();
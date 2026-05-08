import * as tl from "azure-pipelines-task-lib/task";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import * as path from "path";
import { getArtifactToolPath } from "./artifactToolResolver";

async function run(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    let artifactToolPath: string = "";
    try {
        artifactToolPath = await getArtifactToolPath();
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("Error_FailedToGetArtifactTool", error?.message ?? String(error)));
        return;
    } finally {
        logPreJobTelemetry(artifactToolPath);
    }
}

function logPreJobTelemetry(artifactToolPath: string): void {
    try {
        telemetry.emitTelemetry("Packaging", "UniversalPackagesV1", {
            "command": tl.getInput("command"),
            "artifactToolPath": artifactToolPath,
            "overrideArtifactToolPath": tl.getVariable("UPack.OverrideArtifactToolPath") || "",
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
        });
    } catch (err) {
        tl.debug(tl.loc("Debug_FailedToEmitPreJobTelemetry", err.message));
    }
}

run();

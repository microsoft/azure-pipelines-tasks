import * as tl from "azure-pipelines-task-lib/task";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import * as path from "path";
import { getSystemAccessToken, validateServerType } from "./universalPackageHelpers";

async function run(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    // Getting artifact tool
    tl.debug(tl.loc("Debug_GettingArtifactTool"));
    let artifactToolPath: string = "";

    try {
        if (!(await validateServerType())) return;

        // Check if another pre-job instance already resolved the artifact tool path
        const cachedPath = tl.getVariable("UPACK_ARTIFACTTOOL_PATH_CACHED");
        if (cachedPath) {
            console.log(tl.loc("Info_ArtifactToolPathResolvedFromCache"));
            artifactToolPath = cachedPath;
        } else {
            const localAccessToken = getSystemAccessToken();
            if (!localAccessToken) {
                throw new Error(tl.loc("Error_NoAccessToken"));
            }
            tl.setSecret(localAccessToken);

            const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
            const blobUri = await clientToolUtils.getBlobstoreUriFromBaseServiceUri(
                serviceUri,
                localAccessToken);

            tl.debug(tl.loc("Debug_RetrievingArtifactToolUri", blobUri));

            // Finding artifact tool path directory
            artifactToolPath = await retryOnException(
                () => artifactToolUtilities.getArtifactToolFromService(
                    blobUri,
                    localAccessToken,
                    "artifacttool"), 3, 1000);

            tl.setVariable("UPACK_ARTIFACTTOOL_PATH_CACHED", artifactToolPath);
        }

        tl.debug(tl.loc("Debug_ArtifactToolPath", artifactToolPath));
        tl.setTaskVariable('UPACK_ARTIFACTTOOL_PATH', artifactToolPath);
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

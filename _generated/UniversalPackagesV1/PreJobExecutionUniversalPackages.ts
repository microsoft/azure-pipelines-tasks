import tl = require('azure-pipelines-task-lib/task');
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import * as path from "path";

async function run(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    // Getting artifact tool
    tl.debug(tl.loc("Debug_GettingArtifactTool"));
    let artifactToolPath: string = "";

    try {
        const serverType = tl.getVariable("System.ServerType");
        if (!serverType || serverType.toLowerCase() !== "hosted") {
            throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        }

        // Check if another pre-job instance already resolved the artifact tool path
        const cachedPath = tl.getVariable("UPACK_ARTIFACTTOOL_PATH_CACHED");
        if (cachedPath) {
            console.log(tl.loc("Info_ArtifactToolPathResolvedFromCache"));
            artifactToolPath = cachedPath;
        } else {
            const localAccessToken = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false)?.parameters?.['AccessToken'];
            const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
            const blobUri = await clientToolUtils.getBlobstoreUriFromBaseServiceUri(
                serviceUri,
                localAccessToken);

            tl.debug(tl.loc("Debug_RetrievingArtifactToolUri", blobUri));

            // Finding the artifact tool directory
            artifactToolPath = await retryOnException(
                () => artifactToolUtilities.getArtifactToolFromService(
                    blobUri,
                    localAccessToken,
                    "artifacttool"), 3, 1000);

            // Cache for other task instances in this job
            tl.setVariable("UPACK_ARTIFACTTOOL_PATH_CACHED", artifactToolPath);
        }

        tl.debug(tl.loc("Debug_ArtifactToolPath", artifactToolPath));
        tl.setTaskVariable('UPACK_ARTIFACTTOOL_PATH', artifactToolPath);
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("Error_FailedToGetArtifactTool", error.message));
        return;
    } finally {
        logPreJobTelemetry(artifactToolPath);
    }
}

function logPreJobTelemetry(artifactToolPath: string): void {
    try {
        const preJobTelemetry = {
            "command": tl.getInput("command"),
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            "artifactToolPath": artifactToolPath,
        };

        telemetry.emitTelemetry("Packaging", "UniversalPackagesV1", preJobTelemetry);
    } catch (err) {
        tl.debug(`Unable to log Universal Packages pre-job telemetry. Err:( ${err} )`);
    }
}

run();

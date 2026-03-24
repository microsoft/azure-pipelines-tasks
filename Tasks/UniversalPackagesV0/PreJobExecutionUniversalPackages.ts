import tl = require('azure-pipelines-task-lib/task');
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common/locationUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import * as path from "path";
import { logUniversalStartupVariables } from './universaltelemetry';

async function run(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    // Getting artifact tool
    tl.debug("Getting artifact tool");
    let artifactToolPath: string = "";

    try {
        const serverType = tl.getVariable("System.ServerType");
        if (!serverType || serverType.toLowerCase() !== "hosted") {
            throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        }

        // Check if another pre-job instance already resolved the artifact tool path
        const cachedPath = tl.getVariable("UPACK_ARTIFACTTOOL_PATH_CACHED");
        if (cachedPath) {
            tl.debug("Artifact tool path resolved from cached pipeline variable");
            artifactToolPath = cachedPath;
        } else {
            const localAccessToken = pkgLocationUtils.getSystemAccessToken();
            const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
            const blobUri = await pkgLocationUtils.getBlobstoreUriFromBaseServiceUri(
                serviceUri,
                localAccessToken);

            tl.debug(tl.loc("Info_RetrievingArtifactToolUri", blobUri));

            // Finding the artifact tool directory
            artifactToolPath = await pkgLocationUtils.retryOnExceptionHelper(
                () => artifactToolUtilities.getArtifactToolFromService(
                    blobUri,
                    localAccessToken,
                    "artifacttool"), 3, 1000);

            // Cache for other task instances in this job
            tl.setVariable("UPACK_ARTIFACTTOOL_PATH_CACHED", artifactToolPath);
        }

        tl.debug(tl.loc("Info_ArtifactToolPath", artifactToolPath));
        tl.setTaskVariable('UPACK_ARTIFACTTOOL_PATH', artifactToolPath);
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToGetArtifactTool", error.message));
        return;
    } finally {
        logUniversalStartupVariables(artifactToolPath);
    }
}

run();
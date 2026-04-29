import * as tl from "azure-pipelines-task-lib";
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common/locationUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";

const VARIABLE_NAME = "UPACK_ARTIFACTTOOL_PATH";

/**
 * Resolves the artifact tool path, checking the job variable first
 * and downloading from the blob store if not already available.
 * Sets the job variable so subsequent task instances can reuse it.
 */
export async function getArtifactToolPath(): Promise<string> {
    const cachedPath = tl.getVariable(VARIABLE_NAME);
    if (cachedPath) {
        tl.debug(tl.loc("Info_ArtifactToolPathResolvedFromCache"));
        return cachedPath;
    }

    const serverType = tl.getVariable("System.ServerType");
    if (!serverType || serverType.toLowerCase() !== "hosted") {
        throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
    }

    const localAccessToken = pkgLocationUtils.getSystemAccessToken();
    const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
    const blobUri = await pkgLocationUtils.getBlobstoreUriFromBaseServiceUri(
        serviceUri,
        localAccessToken);

    tl.debug(tl.loc("Info_RetrievingArtifactToolUri", blobUri));

    const artifactToolPath = await pkgLocationUtils.retryOnExceptionHelper(
        () => artifactToolUtilities.getArtifactToolFromService(
            blobUri,
            localAccessToken,
            "artifacttool"), 3, 1000);

    tl.debug(tl.loc("Info_ArtifactToolPath", artifactToolPath));
    tl.setVariable(VARIABLE_NAME, artifactToolPath);
    return artifactToolPath;
}

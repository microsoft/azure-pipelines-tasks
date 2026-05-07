import * as tl from "azure-pipelines-task-lib/task";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import { getSystemAccessToken, validateServerType } from "./universalPackageHelpers";

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

    if (!(await validateServerType())) {
        throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
    }

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

    const artifactToolPath = await retryOnException(
        () => artifactToolUtilities.getArtifactToolFromService(
            blobUri,
            localAccessToken,
            "artifacttool"), 3, 1000);

    tl.debug(tl.loc("Debug_ArtifactToolPath", artifactToolPath));
    tl.setVariable(VARIABLE_NAME, artifactToolPath);
    return artifactToolPath;
}

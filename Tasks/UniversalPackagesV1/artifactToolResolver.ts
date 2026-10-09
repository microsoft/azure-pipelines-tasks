import * as tl from "azure-pipelines-task-lib/task";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import { getSystemAccessToken, validateServerType } from "./universalPackageHelpers";

const VARIABLE_NAME = "UPACK_ARTIFACTTOOL_PATH";

/**
 * Resolves the artifact tool path, checking the task variable first
 * and downloading from the blob store if not already available.
 * Sets the task variable so subsequent task instances can reuse it.
 *
 * A task variable (as opposed to a regular job variable) is used here because it is
 * never exported to process.env under its plain name and cannot be set by queue-time
 * parameters or other pipeline steps. This prevents a caller-controlled job variable
 * (including one whose dotted name collides with this name after the agent's
 * dot-to-underscore canonicalization) from being trusted as the path to this
 * executable.
 */
export async function getArtifactToolPath(): Promise<string> {
    const cachedPath = tl.getTaskVariable(VARIABLE_NAME);
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
    tl.setTaskVariable(VARIABLE_NAME, artifactToolPath);
    return artifactToolPath;
}

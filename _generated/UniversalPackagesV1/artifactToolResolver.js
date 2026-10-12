"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArtifactToolPath = getArtifactToolPath;
const tl = require("azure-pipelines-task-lib/task");
const clientToolUtils = require("azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities");
const artifactToolUtilities = require("azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities");
const retryUtils_1 = require("azure-pipelines-tasks-artifacts-common/retryUtils");
const universalPackageHelpers_1 = require("./universalPackageHelpers");
const VARIABLE_NAME = "UPACK_ARTIFACTTOOL_PATH";
/**
 * Resolves the artifact tool path, checking the job variable first
 * and downloading from the blob store if not already available.
 * Sets the job variable so subsequent task instances can reuse it.
 */
function getArtifactToolPath() {
    return __awaiter(this, void 0, void 0, function* () {
        const cachedPath = tl.getVariable(VARIABLE_NAME);
        if (cachedPath) {
            tl.debug(tl.loc("Info_ArtifactToolPathResolvedFromCache"));
            return cachedPath;
        }
        if (!(yield (0, universalPackageHelpers_1.validateServerType)())) {
            throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        }
        const localAccessToken = (0, universalPackageHelpers_1.getSystemAccessToken)();
        if (!localAccessToken) {
            throw new Error(tl.loc("Error_NoAccessToken"));
        }
        tl.setSecret(localAccessToken);
        const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
        const blobUri = yield clientToolUtils.getBlobstoreUriFromBaseServiceUri(serviceUri, localAccessToken);
        tl.debug(tl.loc("Debug_RetrievingArtifactToolUri", blobUri));
        const artifactToolPath = yield (0, retryUtils_1.retryOnException)(() => artifactToolUtilities.getArtifactToolFromService(blobUri, localAccessToken, "artifacttool"), 3, 1000);
        tl.debug(tl.loc("Debug_ArtifactToolPath", artifactToolPath));
        tl.setVariable(VARIABLE_NAME, artifactToolPath);
        return artifactToolPath;
    });
}

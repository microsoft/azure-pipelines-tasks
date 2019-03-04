import { BearerCredentialHandler } from "azure-devops-node-api/handlers/bearertoken";
import { WebApi } from "azure-devops-node-api";
import { IRequestOptions } from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces";

import * as tl from 'vsts-task-lib/task';
import * as locationUtility from "packaging-common/locationUtilities";

// TODO Remove this once this bug is resolved: https://github.com/Microsoft/typed-rest-client/issues/126
export class BearerHandlerForPresignedUrls extends BearerCredentialHandler {
    prepareRequest(options) {
        // If we have a presigned blobstore url, don't add auth header
        if (this.isPreSignedUrl(options)) {
            delete options.headers["Authorization"];
            delete options.headers["X-TFS-FedAuthRedirect"];
        } else {
            options.headers["Authorization"] = "Bearer " + this.token;
            options.headers["X-TFS-FedAuthRedirect"] = "Suppress";
        }
    }

    isPreSignedUrl(options: any): boolean {
        return (
            options.host &&
            options.host.endsWith("blob.core.windows.net") &&
            options.path &&
            options.path.includes("&sig=")
        );
    }
}

export function getConnection(areaId: string, collectionUrl: string): Promise<WebApi> {
    var accessToken = locationUtility.getSystemAccessToken();
    return locationUtility
        .getServiceUriFromAreaId(collectionUrl, accessToken, areaId)
        .then(url => {
            const options: IRequestOptions = {
                proxy: tl.getHttpProxyConfiguration(url)
            };
            return new WebApi(url, new BearerHandlerForPresignedUrls(accessToken), options);
        })
        .catch(error => {
            throw error;
        });
}
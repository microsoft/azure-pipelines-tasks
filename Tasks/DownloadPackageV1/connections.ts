import { BearerCredentialHandler } from "azure-devops-node-api/handlers/bearertoken";
import { WebApi } from "azure-devops-node-api";
import { IRequestOptions } from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces";

import * as tl from 'azure-pipelines-task-lib/task';
import * as locationUtility from "azure-pipelines-tasks-packaging-common-v3/locationUtilities";

export function getConnection(areaId: string, collectionUrl: string): Promise<WebApi> {
    var accessToken = locationUtility.getSystemAccessToken();
    var presignedUrlPatterns: RegExp[] = [
        new RegExp('.*blob\.core\.windows\.net.*'), // blobstore redirect
        new RegExp('.*vsblob\.vsassets\.io.*')  // edge caching enabled blob
    ];

    return locationUtility
        .getServiceUriFromAreaId(collectionUrl, accessToken, areaId)
        .then(url => {
            const options: IRequestOptions = {
                proxy: tl.getHttpProxyConfiguration(url),
                maxRetries: 5,
                allowRetries: true,
                presignedUrlPatterns: presignedUrlPatterns
            };
            return new WebApi(url, new BearerCredentialHandler(accessToken), options);
        })
        .catch(error => {
            throw error;
        });
}
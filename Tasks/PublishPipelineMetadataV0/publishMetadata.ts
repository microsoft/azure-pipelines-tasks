import tl = require('azure-pipelines-task-lib/task');
import { WebRequest, WebResponse, sendRequest } from 'utility-common-v2/restutilities';

interface RelatedUrl {
    "url": string;
    "label": string;
}

interface AttestationRequestPayload {
    name: string;
    description?: string;
    resourceUri: string[];
    kind: string;
    relatedUrl?: RelatedUrl[];
    humanReadableName?: string;
    serializedPayload: string;
}

function getPipelineMetadataObjects(): any {
    const pipelineMetadataRequestBodyString = "METADATA";
    const allVariables = tl.getVariables();
    let requestObjects = [];
    allVariables.forEach(v => {
        if (v.name.startsWith(pipelineMetadataRequestBodyString)) {
            requestObjects.push(JSON.parse(v.value));
        }
    });

    return requestObjects;
}

function constructMetadataRequestBody(requestObject: any): AttestationRequestPayload {
    if (!requestObject.name) {
        throw tl.debug("Not pushing metadata as no name found in request payload");
    }

    const metadata = requestObject.metadata;
    if (!metadata) {
        throw tl.debug("Not pushing metadata as no metadata found");
    }

    if (!metadata.serializedPayload) {
        throw tl.debug("Not pushing metadata as no metadata.serializedPayload found");
    }

    let resourceUri: string[] = [];
    const resourceIds = tl.getVariable("RESOURCE_URIS");
    if (!requestObject.resourceUris) {
        if (resourceIds) {
            const resourceIdArray = resourceIds.split(",");
            if (resourceIdArray.length == 0) {
                throw tl.loc("Not pushing metadata as no resource Ids found");
            }
            else {
                resourceUri = resourceIdArray;
            }
        }
        else {
            throw tl.loc("Not pushing metadata as no resource Ids found");
        }
    }
    else {
        resourceUri = requestObject.resourceUris;
    }

    let requestBody: AttestationRequestPayload = {
        name: requestObject.name,
        kind: "ATTESTATION",
        resourceUri: resourceUri,
        serializedPayload: metadata.serializedPayload
    };

    if (metadata.description) {
        requestBody.description = metadata.description;
    }

    if (metadata.humanReadableName) {
        requestBody.humanReadableName = metadata.humanReadableName;
    }

    if (metadata.relatedUrl) {
        requestBody.relatedUrl = metadata.relatedUrl;
    }

    return requestBody;
}

async function run() {
    try {
        const metadataObjects = getPipelineMetadataObjects();
        if (metadataObjects.length == 0) {
            tl.debug("Not pushing as no metadata found");
            return;
        }

        const requestUrl = tl.getVariable("System.TeamFoundationCollectionUri") + tl.getVariable("System.TeamProject") + "/_apis/deployment/attestationdetails?api-version=5.2-preview.1";
        metadataObjects.forEach((requestPayload: any) => {
            const requestObject: AttestationRequestPayload = constructMetadataRequestBody(requestPayload);
            sendRequestToImageStore(JSON.stringify(requestObject), requestUrl).then((result) => {
                tl.debug("ImageDetailsApiResponse: " + JSON.stringify(result));
                if (result.statusCode < 200 && result.statusCode >= 300) {
                    throw tl.debug("publishToImageMetadataStore failed with error: " + result.statusMessage);
                }
            }, (error) => {
                throw tl.debug("publishToImageMetadataStore failed with error: " + error);
            });
        });
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

async function sendRequestToImageStore(requestBody: string, requestUrl: string): Promise<any> {
    const request = new WebRequest();
    const accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
    request.uri = requestUrl;
    request.method = 'POST';
    request.body = requestBody;
    request.headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken
    };

    tl.debug("requestUrl: " + requestUrl);
    tl.debug("requestBody: " + requestBody);
    tl.debug("accessToken: " + accessToken);

    const response = await sendRequest(request);
    return response;
}

run();
import msRestAzure = require("./ms-rest-azure");
import azureServiceClient = require("./AzureServiceClient");

export class ResourceManagementClient {
    public apiVersion;
    public acceptLanguage;
    private longRunningOperationRetryTimeout;
    private generateClientRequestId;
    private subscriptionId;
    private credentials;
    private baseUri;

    public deployments;
    public resourceGroups;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId) {
        this.apiVersion = '2016-07-01';
        this.acceptLanguage = 'en-US';
        this.longRunningOperationRetryTimeout = 30;
        this.generateClientRequestId = true;
        if (credentials === null || credentials === undefined) {
            throw new Error('\'credentials\' cannot be null.');
        }
        if (subscriptionId === null || subscriptionId === undefined) {
            throw new Error('\'subscriptionId\' cannot be null.');
        }
        this.baseUri = 'https://management.azure.com';
        this.credentials = credentials;
        this.subscriptionId = subscriptionId;
        this.resourceGroups = new ResourceGroups(this);
    }
}

export class ResourceGroups {
    private client;
    constructor(armClient: ResourceManagementClient) {
        this.client = armClient;
    }

    public checkExistence(resourceGroupName: string, callback) {
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (resourceGroupName !== null && resourceGroupName !== undefined) {
                if (resourceGroupName.length > 90) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "MaxLength": 90');
                }
                if (resourceGroupName.length < 1) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "MinLength": 1');
                }
                if (resourceGroupName.match(/^[-\w\._\(\)]+$/) === null) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "Pattern": /^[-\w\._\(\)]+$/');
                }
            }
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(this.client.apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'HEAD';
        httpRequest.headers = {};
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;
        // Send Request
        var client = new azureServiceClient.ServiceClient(this.client.credentials);
        return client.request(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.error) {
                callback(response.error);
                return;
            }
            try {
                if (response.body.error) {
                    if (response.body.error.code === "ResourceGroupNotFound") {
                        callback(null, false);
                        return;
                    }
                    throw new Error(response.body.error);
                }
                callback(null, true);
            } catch (error) {
                callback(error)
                return;
            }
        });
    }
}

export class Deployments {

}
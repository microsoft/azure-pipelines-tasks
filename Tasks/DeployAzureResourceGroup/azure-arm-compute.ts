import msRestAzure = require("./ms-rest-azure");
import azureServiceClient = require("./AzureServiceClient");

export class ComputeManagementClient {
    public apiVersion;
    public acceptLanguage;
    private longRunningOperationRetryTimeout;
    private generateClientRequestId;
    private subscriptionId;
    private credentials;
    private baseUri;

    public virtualMachines;

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
        this.virtualMachines = new VirtualMachines(this);
    }
}

class VirtualMachines {
    private client;
    constructor(client: ComputeManagementClient) {
        this.client = client;
    }

    public restart(resourceGroupName: string, vmName: string, callback) {
        var client = this.client;
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error('vmName cannot be null or undefined and it must be of type string.');
            }
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/restart';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{vmName}', encodeURIComponent(vmName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');

        // Create object
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'POST';
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
        var serviceClient = new azureServiceClient.ServiceClient(this.client.credentials);
        serviceClient.post(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.error) {
                callback(response.error);
            }
            serviceClient.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse)=>{
                if(operationResponse.body.status === "Succeeded") {
                    // Generate Response
                    callback(null);
                } else {
                    // Generate Error
                    callback()
                }
            });
        });
    }
} 